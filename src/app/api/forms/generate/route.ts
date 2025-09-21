import { NextRequest, NextResponse } from 'next/server';
import { OptimizedPHIRedactor } from '@/lib/phi-redaction-optimized';

export async function POST(request: NextRequest) {
  try {
    const { formId, transcript, reservationId, clinicianSummary, canonicalIR } = await request.json();

    if (!formId || !transcript) {
      return NextResponse.json({ error: 'Form ID and transcript are required' }, { status: 400 });
    }

    // Generate form data using LLM based on transcript and IR
    const formData = await generateFormData(formId, transcript, clinicianSummary, canonicalIR);

    // Redact PHI from form data before sending to client using optimized redactor
    const redactedFormData = OptimizedPHIRedactor.redactObject(formData);

    return NextResponse.json(redactedFormData);
  } catch (error) {
    console.error('Error generating form data:', error);
    return NextResponse.json({ error: 'Failed to generate form data' }, { status: 500 });
  }
}

async function generateFormData(formType: string, transcript: string, clinicianSummary?: any, canonicalIR?: any) {
  try {
    // Create prompt based on form type with RAG context and IR
    const prompt = await createFormPrompt(formType, transcript, clinicianSummary, canonicalIR);

    // Call Ollama API
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          max_tokens: 1500 // Increased for more detailed responses
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const result = await response.json();
    const generatedText = result.response || '';
    
    console.log(`Generated text for ${formType}:`, generatedText.substring(0, 500) + '...');

    // Parse the generated text into form data
    const parsedData = parseFormData(formType, generatedText);
    console.log(`Parsed data for ${formType}:`, parsedData);
    
    // Add citations to the form data
    const formDataWithCitations = addCitationsToFormData(formType, parsedData, transcript);
    
    // Clean up any placeholder text
    const cleanedFormData = cleanPlaceholderText(formDataWithCitations);
    
    return cleanedFormData;
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    // Return default form data if LLM fails
    return getDefaultFormData(formType);
  }
}

async function createFormPrompt(formType: string, transcript: string, clinicianSummary?: any, canonicalIR?: any): Promise<string> {
  // Extract key medical terms for RAG search
  const medicalTerms = extractMedicalTerms(transcript);
  console.log('Extracted medical terms:', medicalTerms);
  
  // Get PubMed information using RAG
  const ragContext = await getPubMedContext(medicalTerms);
  console.log('PubMed context:', ragContext.substring(0, 200) + '...');
  
  // Debug logging for canonical IR
  if (canonicalIR) {
    console.log('Using Canonical IR for form generation:', JSON.stringify(canonicalIR, null, 2));
  }
  
  // Debug logging for clinician summary
  if (clinicianSummary && formType === 'patient_summary') {
    console.log('Using clinician summary for patient summary generation:', JSON.stringify(clinicianSummary, null, 2));
  }
  
  const basePrompt = `You are a medical AI assistant helping doctors fill out forms based on consultation transcripts. 

CONSULTATION TRANSCRIPT:
${transcript}

MEDICAL CONTEXT (from PubMed research):
${ragContext}

${canonicalIR ? `
CANONICAL INTERMEDIATE REPRESENTATION (IR) - SINGLE SOURCE OF TRUTH:
${JSON.stringify(canonicalIR, null, 2)}

CRITICAL: Use ONLY the information from the Canonical IR above. This is the single source of truth for both clinician and patient summaries.

IR-BASED GENERATION RULES:
1. Use ONLY medications listed in the IR medications array
2. Use ONLY diagnoses from the IR diagnoses array with their exact certainty levels
3. Use ONLY plan items from the IR plan array
4. Use ONLY follow-up timing and conditions from the IR follow_up object
5. Use ONLY examination findings from the IR exam object
6. Do NOT add any medications, diagnoses, or treatments not present in the IR
7. If IR field is empty or missing, use "Not specified" or leave empty

MEDICATION NORMALIZATION:
- Convert medical frequencies to patient-friendly format (q6h → "每6小時一次")
- Include both generic and brand names when available
- Use exact doses and routes from IR

CERTAINTY ALIGNMENT:
- If IR certainty is "possible" → use "可能" or "或許" in patient version
- If IR certainty is "likely" → use "大機會" or "很可能" in patient version  
- If IR certainty is "confirmed" → use "確診" or "確定" in patient version
- If IR certainty is "unlikely" → use "機會較低" or "不太可能" in patient version

` : ''}

${clinicianSummary && formType === 'patient_summary' ? `
CLINICIAN SUMMARY (for reference and alignment):
${JSON.stringify(clinicianSummary, null, 2)}

CRITICAL: The Patient Summary must align with the Clinician Summary above. Use the same medical information but with patient-friendly language. Pay special attention to:

MEDICATIONS ALIGNMENT:
- If Clinician Summary mentions "Antipyretics for fever management, such as acetaminophen or ibuprofen", Patient Summary should mention "acetaminophen (Tylenol) or ibuprofen (Advil) for fever reduction"
- If Clinician Summary mentions "antibiotics", Patient Summary should mention "antibiotics to help fight the infection"
- NEVER mention medications that aren't in the Clinician Summary

FOLLOW-UP TIMING ALIGNMENT:
- If Clinician Summary says "Follow-up appointment in 7 days", Patient Summary MUST say "follow-up appointment in 7 days" (exact same number)
- If Clinician Summary says "Follow-up appointment in 3 days", Patient Summary MUST say "follow-up appointment in 3 days" (exact same number)
- NEVER use different follow-up timing than what's specified in Clinician Summary

DIAGNOSIS ALIGNMENT:
- Use the same diagnosis but explain it in simple, caring terms
- If Clinician Summary mentions "dengue fever", Patient Summary should explain "dengue fever" in patient-friendly language

TREATMENT PLAN ALIGNMENT:
- Convert the clinical treatment plan into patient-friendly instructions
- Use the same medications and treatments mentioned in Clinician Summary
` : ''}

INSTRUCTIONS:
- Extract relevant information from the transcript
- Use the PubMed context to ensure medical accuracy
- Fill in the form fields with appropriate medical data
- For common fields (medications, diagnosis, treatment, follow-up), ensure content alignment with different tones
- Clinician Summary: Use professional medical terminology
- Patient Summary: Use caring, patient-friendly language
- CRITICAL: The medications in Patient Summary must align with the treatment plan in Clinician Summary
- CRITICAL: The follow-up plan in Patient Summary must align EXACTLY with the follow-up in Clinician Summary
- CRITICAL: For Patient Summary, if Clinician Summary is provided, use EXACTLY the same medications and follow-up timing
- If Clinician Summary mentions "Antipyretics for fever management, such as acetaminophen or ibuprofen", Patient Summary should mention "acetaminophen (Tylenol) or ibuprofen (Advil) for fever reduction"
- If Clinician Summary mentions "antibiotics", Patient Summary should mention "antibiotics to help fight the infection"
- If Clinician Summary mentions "Follow-up appointment in X days", Patient Summary MUST mention "follow-up appointment in X days" (exact same timing)
- NEVER use different follow-up timing between the two forms - they must be identical
- NEVER mention medications in Patient Summary that aren't mentioned in Clinician Summary
- NEVER use placeholder text like [X] or [insert date] - always use actual numbers and specific timing

MANDATORY GROUNDING REQUIREMENTS:
- EVERY field that contains medical information MUST have source anchors [S1], [S2], [S3], etc.
- EVERY bullet point, numbered list item, or medical statement MUST be traceable to the consultation transcript
- Use citation numbers [S1], [S2], [S3], etc. for ALL medical findings, symptoms, treatments, and recommendations
- Example: "Patient presents with headache [S1] and fever [S2]" where [S1] and [S2] reference specific transcript entries
- Example: "• Temperature: 37.9°C [S3]\n• Blood pressure: 118/75 [S4]" - each bullet point must have a source anchor
- Example: "1. Prescribe acetaminophen [S5]\n2. Monitor symptoms [S6]" - each numbered item must have a source anchor
- If information is not available, use "Not specified" or leave empty
- Return ONLY a JSON object with the form data

FORM TYPE: ${formType}

`;

  switch (formType) {
    case 'clinician_summary':
      return basePrompt + `
Generate a JSON object for a Clinician Summary with these fields. Use professional medical terminology and clinical language. Do NOT include patientName, dateOfBirth, dateOfVisit, pastMedicalHistory, or allergies as these will be pre-filled.

MANDATORY: Every field MUST contain source anchors [S1], [S2], [S3], etc. for ALL medical information.

CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no text before or after. Ensure all string values are properly quoted and escaped. Use double quotes for all strings.

{
  "chiefComplaint": "Primary reason for visit [S1]",
  "historyOfPresentIllness": "Detailed description of current symptoms and their progression [S2]",
  "medications": "Current medications and dosages [S3]",
  "physicalExam": "Key physical examination findings [S4]",
  "assessment": "Clinical assessment and differential diagnosis [S5]",
  "plan": "Treatment plan including medications, procedures, and recommendations [S6]",
  "followUp": "Follow-up schedule and next steps [S7]"
}`;

    case 'patient_summary':
      return basePrompt + `
Generate a JSON object for a Patient Summary with these fields. Use a caring, friendly, easy-to-understand tone. For common fields like medications and diagnosis, ensure the medical content aligns with the clinician summary but with patient-friendly language. Do NOT include patientName or date as these will be pre-filled.

CRITICAL MANDATORY GROUNDING REQUIREMENTS - NO EXCEPTIONS:
- EVERY SINGLE field MUST contain source anchors [S1], [S2], [S3], etc. for ALL medical information
- NO field can be empty or missing source anchors - THIS IS MANDATORY
- Each field must have at least one [S#] anchor - NO EXCEPTIONS
- Source anchors must be placed at the end of relevant medical statements
- Example: "You have a headache [S1] and fever [S2] that we're monitoring closely [S3]"
- Another example: "Take your medication as directed [S4] and rest at home [S5]"

WARNING: If you do not include source anchors [S#] in every field, the response will be considered invalid and will fail validation.

CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no text before or after. Ensure all string values are properly quoted and escaped. Use double quotes for all strings.

{
  "diagnosis": "Your diagnosis explained in simple, caring terms (align with clinician assessment) [S1]",
  "medications": "Your medications with clear names and purposes (align with clinician treatment plan) [S2]",
  "instructions": "How to take your medications (when, how often, with food, etc.) with caring guidance [S3]",
  "homeCare": "What you can do at home to help with your condition - explained with care and encouragement [S4]",
  "recovery": "What to expect during your recovery and how to take care of yourself with supportive language [S5]",
  "followUp": "When to come back for your next appointment with reassurance (must align exactly with clinician follow-up timing and content) [S6]",
  "warningSigns": "Signs and symptoms to watch out for that need immediate attention - explained with concern [S7]",
  "whenToSeekHelp": "When and how to contact your doctor or seek emergency care - with caring guidance [S8]"
}`;

    default:
      return basePrompt + `Generate appropriate form data for ${formType} based on the transcript.`;
  }
}

// Extract medical terms from transcript for RAG search
function extractMedicalTerms(transcript: string): string[] {
  const medicalKeywords = [
    'fever', 'cough', 'pain', 'headache', 'nausea', 'vomiting', 'diarrhea', 'constipation',
    'chest pain', 'shortness of breath', 'dizziness', 'fatigue', 'weakness', 'rash',
    'infection', 'inflammation', 'hypertension', 'diabetes', 'asthma', 'pneumonia',
    'bronchitis', 'sinusitis', 'pharyngitis', 'tonsillitis', 'otitis', 'conjunctivitis',
    'allergy', 'allergic', 'medication', 'drug', 'treatment', 'therapy', 'surgery',
    'diagnosis', 'symptoms', 'signs', 'examination', 'test', 'lab', 'x-ray', 'scan'
  ];
  
  const words = transcript.toLowerCase().split(/\s+/);
  const foundTerms = words.filter(word => 
    medicalKeywords.some(keyword => 
      word.includes(keyword) || keyword.includes(word)
    )
  );
  
  return [...new Set(foundTerms)]; // Remove duplicates
}

// Get PubMed context using RAG
async function getPubMedContext(medicalTerms: string[]): Promise<string> {
  if (medicalTerms.length === 0) {
    return "No specific medical terms identified for research.";
  }
  
  try {
    // Search PubMed for relevant medical information
    const searchQuery = medicalTerms.slice(0, 5).join(' OR '); // Limit to top 5 terms
    const response = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmax=3&retmode=json`);
    
    if (!response.ok) {
      return "Unable to access medical research database.";
    }
    
    const data = await response.json();
    const pmids = data.esearchresult?.idlist || [];
    
    if (pmids.length === 0) {
      return "No relevant medical research found for the identified terms.";
    }
    
    // Get abstracts for the found articles
    const abstractResponse = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`);
    
    if (!abstractResponse.ok) {
      return "Unable to retrieve medical research details.";
    }
    
    const abstractText = await abstractResponse.text();
    
    // Extract relevant information from abstracts (simplified)
    const abstracts = abstractText.match(/<AbstractText[^>]*>(.*?)<\/AbstractText>/g) || [];
    const relevantInfo = abstracts.slice(0, 2).map(abstract => 
      abstract.replace(/<[^>]*>/g, '').substring(0, 200)
    ).join(' ');
    
    return relevantInfo || "Medical research context retrieved but no specific details available.";
    
  } catch (error) {
    console.error('Error fetching PubMed context:', error);
    return "Unable to access medical research database at this time.";
  }
}

function parseFormData(formType: string, generatedText: string): Record<string, any> {
  try {
    // Try to extract JSON from the response
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonString = jsonMatch[0];
      console.log('Attempting to parse JSON:', jsonString.substring(0, 200) + '...');
      
      // First try parsing as-is
      try {
        return JSON.parse(jsonString);
      } catch (firstError) {
        console.log('First parse attempt failed, trying to clean JSON...');
        
        // Try to fix common JSON issues
        let cleanedJson = jsonString
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes around unquoted keys
          .replace(/:(\s*)([^",{\[\s][^,}\]]*?)(\s*[,}])/g, ': "$2"$3'); // Add quotes around unquoted string values
      
        try {
          return JSON.parse(cleanedJson);
        } catch (parseError) {
          console.error('JSON parse error after cleaning:', parseError);
          console.log('Cleaned JSON:', cleanedJson.substring(0, 500) + '...');
          
          // Try a more aggressive cleaning approach
          const aggressiveClean = jsonString
            .replace(/[\r\n\t]/g, ' ') // Replace all whitespace with spaces
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
            .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes around unquoted keys
            .replace(/:(\s*)([^",{\[\s][^,}\]]*?)(\s*[,}])/g, ': "$2"$3'); // Add quotes around unquoted string values
          
          try {
            return JSON.parse(aggressiveClean);
          } catch (secondError) {
            console.error('Second JSON parse attempt failed:', secondError);
            console.log('Aggressive clean JSON:', aggressiveClean.substring(0, 500) + '...');
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing generated form data:', error);
    console.log('Raw generated text:', generatedText);
  }

  // Fallback to default data
  console.log('Using fallback default data for form type:', formType);
  const fallbackData = getDefaultFormData(formType);
  console.log('Fallback data:', fallbackData);
  return fallbackData;
}

function addCitationsToFormData(formType: string, formData: Record<string, any>, transcript: string): Record<string, any> {
  const citations: any[] = [];
  let citationId = 1;

  // Extract consultation transcript entries
  const transcriptEntries = extractTranscriptEntries(transcript);
  
  // Generate citations for each field
  const fieldsToCite = getFieldsToCite(formType);
  
  fieldsToCite.forEach(field => {
    const content = formData[field];
    if (content && content.trim() && content !== 'Please complete based on consultation') {
      // Find matching transcript entry
      const matchingEntry = findMatchingTranscriptEntry(content, transcriptEntries);
      
      if (matchingEntry) {
        citations.push({
          id: citationId,
          type: 'consultation',
          section: getFieldDisplayName(field),
          content: matchingEntry.content,
          source: 'Consultation transcript',
          timestamp: matchingEntry.timestamp
        });
        
        // Add citation number to the content if it doesn't already have one
        if (!content.includes(`[S${citationId}]`)) {
          formData[field] = content + ` [S${citationId}]`;
        }
        
        citationId++;
      }
    }
  });

  return {
    ...formData,
    citations: citations
  };
}

function extractTranscriptEntries(transcript: string): any[] {
  if (!transcript) return [];
  
  const entries: any[] = [];
  const lines = transcript.split('\n');
  
  lines.forEach(line => {
    const match = line.match(/\[(\d{2}:\d{2}:\d{2})\]\s+SPEAKER:\s+(.+)/);
    if (match) {
      entries.push({
        timestamp: match[1],
        content: match[2].trim()
      });
    }
  });
  
  return entries;
}

function findMatchingTranscriptEntry(content: string, transcriptEntries: any[]): any | null {
  if (!content || !transcriptEntries.length) return null;
  
  // Look for transcript entries that contain similar content
  const contentWords = content.toLowerCase().split(/\s+/).filter(word => word.length > 3);
  
  for (const entry of transcriptEntries) {
    const entryWords = entry.content.toLowerCase().split(/\s+/);
    const matchingWords = contentWords.filter(word => 
      entryWords.some((entryWord: string) => entryWord.includes(word) || word.includes(entryWord))
    );
    
    // If we have a good match (at least 2 words or 50% of content words)
    if (matchingWords.length >= Math.min(2, Math.ceil(contentWords.length * 0.5))) {
      return entry;
    }
  }
  
  return null;
}

function getFieldsToCite(formType: string): string[] {
  switch (formType) {
    case 'clinician_summary':
      return ['chiefComplaint', 'historyOfPresentIllness', 'physicalExam', 'assessment', 'plan'];
    case 'patient_summary':
      return ['diagnosis', 'medications', 'instructions', 'homeCare', 'recovery', 'warningSigns'];
    default:
      return [];
  }
}

function getFieldDisplayName(field: string): string {
  const fieldNames: Record<string, string> = {
    chiefComplaint: 'Chief Complaint',
    historyOfPresentIllness: 'History of Present Illness',
    physicalExam: 'Physical Examination',
    assessment: 'Assessment',
    plan: 'Treatment Plan',
    diagnosis: 'Diagnosis',
    medications: 'Medications',
    instructions: 'Medication Instructions',
    homeCare: 'Home Care',
    recovery: 'Recovery',
    warningSigns: 'Warning Signs'
  };
  
  return fieldNames[field] || field;
}

function cleanPlaceholderText(formData: Record<string, any>): Record<string, any> {
  const cleaned = { ...formData };
  
  // Clean up common placeholder patterns
  Object.keys(cleaned).forEach(key => {
    if (typeof cleaned[key] === 'string') {
      cleaned[key] = cleaned[key]
        .replace(/\[X\]/g, '7') // Replace [X] with 7 days as default
        .replace(/\[insert date\]/gi, '7 days')
        .replace(/\[insert time\]/gi, '7 days')
        .replace(/\[number\]/gi, '7')
        .replace(/\[days\]/gi, '7 days')
        .replace(/\[timeframe\]/gi, '7 days')
        .replace(/\[X\] days/g, '7 days') // Handle "X days" pattern
        .replace(/\[X\] days from today/g, '7 days from today')
        .replace(/in \[X\] days/g, 'in 7 days')
        .replace(/\[X\] days from today/g, '7 days from today');
    }
  });
  
  return cleaned;
}


function getDefaultFormData(formType: string): Record<string, any> {
  switch (formType) {
    case 'clinician_summary':
      return {
        chiefComplaint: 'Please complete based on consultation',
        historyOfPresentIllness: 'Please complete based on consultation',
        medications: 'Please complete based on consultation',
        physicalExam: 'Please complete based on consultation',
        assessment: 'Please complete based on consultation',
        plan: 'Please complete based on consultation',
        followUp: 'Please complete based on consultation'
      };

    case 'patient_summary':
      return {
        diagnosis: 'Please complete based on consultation',
        medications: 'Please complete based on consultation',
        instructions: 'Please complete based on consultation',
        homeCare: 'Please complete based on consultation',
        recovery: 'Please complete based on consultation',
        followUp: 'Please complete based on consultation',
        warningSigns: 'Please complete based on consultation',
        whenToSeekHelp: 'Please complete based on consultation'
      };

    default:
      return {};
  }
}

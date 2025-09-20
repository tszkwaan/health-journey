import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { formId, transcript, reservationId } = await request.json();

    if (!formId || !transcript) {
      return NextResponse.json({ error: 'Form ID and transcript are required' }, { status: 400 });
    }

    // Generate form data using LLM based on transcript
    const formData = await generateFormData(formId, transcript);

    // Send WebSocket notification if reservationId is provided
    if (reservationId) {
      try {
        await fetch(`http://localhost:8000/api/forms/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId,
            formId,
            formData,
            type: 'form_generated'
          })
        });
      } catch (wsError) {
        console.warn('Failed to send WebSocket notification:', wsError);
      }
    }

    return NextResponse.json(formData);
  } catch (error) {
    console.error('Error generating form data:', error);
    
    // Send error notification if reservationId is provided
    if (reservationId) {
      try {
        await fetch(`http://localhost:8000/api/forms/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId,
            formId: formId || 'unknown',
            error: 'Form generation failed',
            type: 'form_generation_error'
          })
        });
      } catch (wsError) {
        console.warn('Failed to send WebSocket error notification:', wsError);
      }
    }
    
    return NextResponse.json({ error: 'Failed to generate form data' }, { status: 500 });
  }
}

async function generateFormData(formType: string, transcript: string) {
  try {
    // Create prompt based on form type with RAG context
    const prompt = await createFormPrompt(formType, transcript);

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
    
    return parsedData;
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    // Return default form data if LLM fails
    return getDefaultFormData(formType);
  }
}

async function createFormPrompt(formType: string, transcript: string): Promise<string> {
  // Extract key medical terms for RAG search
  const medicalTerms = extractMedicalTerms(transcript);
  
  // Get PubMed information using RAG
  const ragContext = await getPubMedContext(medicalTerms);
  
  const basePrompt = `You are a medical AI assistant helping doctors fill out forms based on consultation transcripts. 

CONSULTATION TRANSCRIPT:
${transcript}

MEDICAL CONTEXT (from PubMed research):
${ragContext}

INSTRUCTIONS:
- Extract relevant information from the transcript
- Use the PubMed context to ensure medical accuracy
- Fill in the form fields with appropriate medical data
- For common fields (medications, diagnosis, treatment), ensure content alignment with different tones
- Clinician Summary: Use professional medical terminology
- Patient Summary: Use caring, patient-friendly language
- CRITICAL: The medications in Patient Summary must align with the treatment plan in Clinician Summary
- If Clinician Summary mentions "Antipyretics for fever management", Patient Summary should mention fever-reducing medications
- If Clinician Summary mentions "antibiotics", Patient Summary should mention antibiotic medications
- If information is not available, use "Not specified" or leave empty
- Return ONLY a JSON object with the form data

FORM TYPE: ${formType}

`;

  switch (formType) {
    case 'clinician_summary':
      return basePrompt + `
Generate a JSON object for a Clinician Summary with these fields. Use professional medical terminology and clinical language. Do NOT include patientName, dateOfBirth, dateOfVisit, pastMedicalHistory, or allergies as these will be pre-filled.

CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no text before or after. Ensure all string values are properly quoted and escaped. Use double quotes for all strings.

{
  "chiefComplaint": "Primary reason for visit",
  "historyOfPresentIllness": "Detailed description of current symptoms and their progression",
  "medications": "Current medications and dosages",
  "physicalExam": "Key physical examination findings",
  "assessment": "Clinical assessment and differential diagnosis",
  "plan": "Treatment plan including medications, procedures, and recommendations",
  "followUp": "Follow-up schedule and next steps"
}`;

    case 'patient_summary':
      return basePrompt + `
Generate a JSON object for a Patient Summary with these fields. Use a caring, friendly, easy-to-understand tone. For common fields like medications and diagnosis, ensure the medical content aligns with the clinician summary but with patient-friendly language. Do NOT include patientName or date as these will be pre-filled.

CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no text before or after. Ensure all string values are properly quoted and escaped. Use double quotes for all strings.

{
  "diagnosis": "Your diagnosis explained in simple, caring terms (align with clinician assessment)",
  "medications": "Your medications with clear names and purposes (align with clinician treatment plan)",
  "instructions": "How to take your medications (when, how often, with food, etc.) with caring guidance",
  "homeCare": "What you can do at home to help with your condition - explained with care and encouragement",
  "recovery": "What to expect during your recovery and how to take care of yourself with supportive language",
  "followUp": "When to come back for your next appointment with reassurance (align with clinician follow-up)",
  "warningSigns": "Signs and symptoms to watch out for that need immediate attention - explained with concern",
  "whenToSeekHelp": "When and how to contact your doctor or seek emergency care - with caring guidance"
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
    const abstracts = abstractText.match(/<AbstractText[^>]*>(.*?)<\/AbstractText>/gs) || [];
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

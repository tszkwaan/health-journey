import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { PHIRedactor, safeLog } from '@/lib/phi-redaction';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    // Check if this is an internal API call (no session but has internal header)
    const isInternalCall = !session && request.headers.get('x-internal-call') === 'true';
    
    if (!isInternalCall) {
      // Regular authentication check for external calls
      if (!session || !session.user || !(session.user as any).id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get the user to check if they're a doctor
      const user = await prisma.user.findUnique({
        where: { id: (session.user as any).id },
        include: {
          doctorProfile: true,
        },
      });

      if (!user || user.role !== 'DOCTOR' || !user.doctorProfile) {
        return NextResponse.json({ error: 'Doctor profile not found' }, { status: 403 });
      }
    }

    // Fetch the reservation with all related data
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            medicalBackgrounds: {
              where: { isCurrent: true },
              select: {
                id: true,
                enhancedSummary: true,
                pastMedicalConditions: true,
                otherMedicalCondition: true,
                surgicalHistory: true,
                medications: true,
                allergies: true,
                otherAllergy: true,
                familyHistory: true,
                otherFamilyHistory: true,
                smoking: true,
                alcohol: true,
                exerciseFrequency: true,
                occupation: true,
                menstrualCycle: true,
                menopause: true,
                pregnancyHistory: true,
                contraceptives: true,
                immunizations: true,
                otherImmunization: true
              }
            }
          }
        },
        intakeSession: {
          select: {
            id: true,
            progress: true,
            answers: true,
          }
        }
      }
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Check if the reservation belongs to this doctor (only for external calls)
    if (!isInternalCall && reservation.doctorId !== user.doctorProfile.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Generate enhanced summary
    const medicalBackground = reservation.patient.medicalBackgrounds[0];
    const intakeAnswers = reservation.intakeSession?.answers;

    if (!medicalBackground || !intakeAnswers) {
      return NextResponse.json({ error: 'Incomplete data for summary generation' }, { status: 400 });
    }

    console.log('Generating enhanced summary for reservation:', id);
    const enhancedSummary = await generateEnhancedSummary(medicalBackground, intakeAnswers, reservation.patient);

    console.log('🔍 DATABASE: About to update medical background with ID:', medicalBackground.id);
    console.log('🔍 DATABASE: Enhanced summary to save:', JSON.stringify(enhancedSummary, null, 2));

    // Update the medical background with the enhanced summary
    const updateResult = await prisma.medicalBackground.update({
      where: { id: medicalBackground.id },
      data: { enhancedSummary: enhancedSummary }
    });

    console.log('🔍 DATABASE: Update result:', updateResult.id);
    safeLog('Enhanced summary generated successfully');

    // Redact PHI from enhanced summary before sending to client
    const redactedSummary = PHIRedactor.redactObject(enhancedSummary);
    
    return NextResponse.json({ enhancedSummary: redactedSummary });

  } catch (error) {
    console.error('Error generating enhanced summary:', error);
    return NextResponse.json({ error: 'Failed to generate enhanced summary' }, { status: 500 });
  }
}

async function generateEnhancedSummary(medicalBackground: any, intakeAnswers: any, patient: any) {
  try {
    // Prepare source data with citations
    const sources = prepareSourceData(medicalBackground, intakeAnswers, patient);
    
    // Get visit reason for external research
    const visitReason = intakeAnswers.visit_reason || intakeAnswers.main_complaint || 'general consultation';
    
    // Create comprehensive prompt for the LLM
    const prompt = await createEnhancedSummaryPrompt(sources, visitReason);

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
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const result = await response.json();
    const summaryText = result.response || 'Unable to generate summary at this time.';

    console.log('🔍 LLM Response:', summaryText);
    console.log('🔍 LLM Response Length:', summaryText.length);

    // Validate LLM response against sources to prevent hallucination
    const validationResult = validateLLMResponse(summaryText, sources);
    if (!validationResult.isValid) {
      console.warn('🚨 LLM Response validation failed:', validationResult.errors);
      // Continue but log the issues
    }

    // Parse the LLM response into structured sections
    const structuredSummary = parseStructuredSummary(summaryText, sources);
    
    console.log('🔍 Parsed Summary:', JSON.stringify(structuredSummary, null, 2));

    return structuredSummary;

  } catch (error) {
    console.error('Error calling Ollama API:', error);
    return {
      currentSituation: 'Summary generation temporarily unavailable.',
      mainConcerns: 'Unable to generate concerns at this time.',
      medicalBackground: 'Medical background data unavailable.',
      aiDiagnosis: 'Diagnosis analysis unavailable.',
      aiSuggestions: 'Suggestions unavailable.',
      citations: []
    };
  }
}

function prepareSourceData(medicalBackground: any, intakeAnswers: any, patient: any) {
  const sources = [];
  let citationId = 1;

  // Patient Demographics (PHI SAFE - no personal identifiers)
  if (intakeAnswers.patient_info) {
    // Calculate age from DOB for medical context without exposing DOB
    let ageInfo = '';
    if (intakeAnswers.patient_info.dob) {
      const birthDate = new Date(intakeAnswers.patient_info.dob);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      ageInfo = `Age: ${age} years`;
    }
    
    sources.push({
      id: citationId++,
      type: 'intake',
      section: 'Patient Demographics',
      content: ageInfo || 'Age: Not provided',
      source: 'Pre-care intake session'
    });
  }

  // Main Complaint
  if (intakeAnswers.main_complaint) {
    sources.push({
      id: citationId++,
      type: 'intake',
      section: 'Main Complaint',
      content: intakeAnswers.main_complaint,
      source: 'Pre-care intake session'
    });
  }

  // Symptom Onset
  if (intakeAnswers.symptom_onset) {
    sources.push({
      id: citationId++,
      type: 'intake',
      section: 'Symptom Onset',
      content: intakeAnswers.symptom_onset,
      source: 'Pre-care intake session'
    });
  }

  // Severity
  if (intakeAnswers.severity) {
    sources.push({
      id: citationId++,
      type: 'intake',
      section: 'Severity',
      content: intakeAnswers.severity,
      source: 'Pre-care intake session'
    });
  }

  // Relevant History
  if (intakeAnswers.relevant_history) {
    sources.push({
      id: citationId++,
      type: 'intake',
      section: 'Relevant History',
      content: intakeAnswers.relevant_history,
      source: 'Pre-care intake session'
    });
  }

  // Allergies
  if (intakeAnswers.allergies) {
    sources.push({
      id: citationId++,
      type: 'intake',
      section: 'Allergies',
      content: Array.isArray(intakeAnswers.allergies) ? intakeAnswers.allergies.join(', ') : intakeAnswers.allergies,
      source: 'Pre-care intake session'
    });
  }

  // Medical Background - Past Conditions
  if (medicalBackground.pastMedicalConditions?.length > 0 || medicalBackground.otherMedicalCondition) {
    const conditions = [
      ...(medicalBackground.pastMedicalConditions || []),
      ...(medicalBackground.otherMedicalCondition ? [medicalBackground.otherMedicalCondition] : [])
    ];
    sources.push({
      id: citationId++,
      type: 'medical_history',
      section: 'Past Medical Conditions',
      content: conditions.join(', '),
      source: 'Medical history form'
    });
  }

  // Medications
  if (medicalBackground.medications?.length > 0) {
    const meds = medicalBackground.medications.map((med: any) => `${med.name}: ${med.dosage} ${med.frequency}`);
    sources.push({
      id: citationId++,
      type: 'medical_history',
      section: 'Current Medications',
      content: meds.join(', '),
      source: 'Medical history form'
    });
  }

  // Allergies from Medical History
  if (medicalBackground.allergies?.length > 0 || medicalBackground.otherAllergy) {
    const allergies = [
      ...(medicalBackground.allergies?.map((a: any) => `${a.type} (${a.reaction})`) || []),
      ...(medicalBackground.otherAllergy ? [medicalBackground.otherAllergy] : [])
    ];
    sources.push({
      id: citationId++,
      type: 'medical_history',
      section: 'Allergies',
      content: allergies.join(', '),
      source: 'Medical history form'
    });
  }

  // Family History
  if (medicalBackground.familyHistory?.length > 0 || medicalBackground.otherFamilyHistory) {
    const familyHistory = [
      ...(medicalBackground.familyHistory || []),
      ...(medicalBackground.otherFamilyHistory ? [medicalBackground.otherFamilyHistory] : [])
    ];
    sources.push({
      id: citationId++,
      type: 'medical_history',
      section: 'Family History',
      content: familyHistory.join(', '),
      source: 'Medical history form'
    });
  }

  // Lifestyle
  if (medicalBackground.smoking?.smokes || medicalBackground.alcohol?.drinks || medicalBackground.exerciseFrequency) {
    const lifestyle = [];
    if (medicalBackground.smoking?.smokes) {
      lifestyle.push(`Smoking: ${medicalBackground.smoking.packsPerDay || 'Unknown'} packs/day`);
    }
    if (medicalBackground.alcohol?.drinks) {
      lifestyle.push(`Alcohol: ${medicalBackground.alcohol.type || 'Unknown'} ${medicalBackground.alcohol.frequency || 'Unknown frequency'}`);
    }
    if (medicalBackground.exerciseFrequency) {
      lifestyle.push(`Exercise: ${medicalBackground.exerciseFrequency}`);
    }
    sources.push({
      id: citationId++,
      type: 'medical_history',
      section: 'Lifestyle',
      content: lifestyle.join(', '),
      source: 'Medical history form'
    });
  }

  return sources;
}

async function getExternalMedicalResearch(visitReason: string) {
  try {
    // Temporarily disable external research to avoid import issues
    console.log('External medical research disabled for now');
    return [];
  } catch (error) {
    console.error('Error getting external medical research:', error);
    return [];
  }
}

async function createEnhancedSummaryPrompt(sources: any[], visitReason: string) {
  // Temporarily disable external research to fix import issues
  const externalResearch: any[] = [];
  
  let prompt = `You are a medical AI assistant helping doctors prepare for patient consultations. Generate a concise summary based on the provided patient data and external medical research.

PATIENT DATA SOURCES:
`;

  sources.forEach((source, index) => {
    prompt += `\n[${index + 1}] ${source.section}: ${source.content} (Source: ${source.source})`;
  });

  if (externalResearch.length > 0) {
    prompt += `\n\nEXTERNAL MEDICAL RESEARCH FOR "${visitReason}":
`;
    externalResearch.forEach((research, index) => {
      prompt += `\n[${sources.length + index + 1}] ${research.title}: ${research.content} (Source: ${research.source})`;
    });
  }

  prompt += `\n\nCRITICAL ANTI-HALLUCINATION RULES:
1. For patient data sections: ONLY use information explicitly provided in the patient sources above
2. For symptoms: ONLY use the exact visit reason provided (e.g., if visit reason is "fever", symptoms should be "fever", not "nausea" or anything else)
3. For AI Diagnosis: Generate realistic differential diagnoses based on the visit reason and medical history
4. For AI Suggestions: Generate specific, actionable questions and tests based on the visit reason
5. DO NOT add symptoms, conditions, or details not mentioned in patient sources
6. If patient information is missing, write "Not provided" or "Unknown"
7. Use exact wording from sources when possible
8. NEVER invent or assume symptoms - only use what is explicitly stated
9. For medications: Only include medications that are relevant to the current visit reason or explicitly mentioned

EXAMPLE: If visit reason is "fever", then:
- symptoms: "fever" (NOT "lobster allergy" or anything else)
- currentVisitReason: "fever"
- aiDiagnosis: should be about fever-related conditions
- aiSuggestions: should be about fever-related questions and tests

Generate a structured summary in JSON format. Return ONLY the JSON object:

{
  "currentSituation": {
    "symptoms": "ONLY the exact visit reason from intake sources - if visit reason is 'fever' then symptoms must be 'fever', NOT allergies or anything else [2]",
    "onset": "ONLY onset information from intake sources [2]",
    "timing": "ONLY timing information from intake sources [2]",
    "severity": "ONLY severity information from intake sources [2]",
    "firstReported": "ONLY reporting information from intake sources [2]"
  },
  "mainConcerns": {
    "currentVisitReason": "ONLY the specific reason for this visit [2]",
    "allergicReactions": "ONLY allergies explicitly mentioned [3]",
    "urgentRedFlagSymptoms": "ONLY red flags explicitly mentioned [2]"
  },
  "medicalBackground": {
    "pastMedicalConditions": "ONLY conditions explicitly mentioned [4]",
    "currentMedications": "ONLY medications explicitly mentioned [5]",
    "allergies": "ONLY allergies explicitly mentioned [3]",
    "familyMedicalHistory": "ONLY family history explicitly mentioned [7]"
  },
  "aiDiagnosis": {
    "possibleDifferentialDiagnoses": "viral infection, bacterial infection, medication side effects, allergic reaction, or other fever-causing conditions [1]",
    "disclaimer": "Note: AI analysis based on medical research and limited patient information - requires clinical confirmation [1]"
  },
  "aiSuggestions": {
    "suggestedFollowUpQuestions": "temperature, duration, associated symptoms, recent exposures, medication history [2]",
    "recommendedTestsExaminations": "temperature measurement, complete blood count, urinalysis, chest X-ray, blood cultures [2]",
    "safetyNotesDisclaimer": "monitor for high fever, signs of dehydration, severe headache, neck stiffness [2]"
  }
}

CRITICAL INSTRUCTIONS: 
- Return ONLY the JSON object, no other text, no explanations, no markdown formatting
- Do not include code blocks or markdown formatting
- Do not include any text before or after the JSON
- Use simple text lists within the string values (no special characters)
- Always include citation numbers [1], [2], etc. for each piece of information
- If information is missing, use "Not provided" or "Unknown"
- Keep each point concise and actionable
- Use medical terminology appropriately

You must respond with ONLY the JSON object, nothing else. Start your response with { and end with }.

Generate the JSON summary now:`;

  return prompt;
}

function validateLLMResponse(summaryText: string, sources: any[]) {
  const errors: string[] = [];
  
  try {
    const summary = JSON.parse(summaryText);
    
    // Extract all text content from the summary
    const allText = JSON.stringify(summary).toLowerCase();
    
    // Create a list of all valid content from sources
    const validContent = sources.map(s => s.content.toLowerCase()).join(' ');
    
    // Check for common hallucination patterns
    const hallucinationPatterns = [
      'fever, headache, fatigue', // Common false symptoms
      'liver disease', // Common false condition
      'viral infection', // Common false diagnosis
      'moderate severity', // Common false severity
      'throughout the day', // Common false timing
    ];
    
    for (const pattern of hallucinationPatterns) {
      if (allText.includes(pattern.toLowerCase()) && !validContent.includes(pattern.toLowerCase())) {
        errors.push(`Potential hallucination detected: "${pattern}" not found in source data`);
      }
    }
    
    // Check if any medical conditions mentioned are not in sources
    const medicalConditions = [
      'diabetes', 'hypertension', 'stroke', 'liver disease', 'heart disease'
    ];
    
    for (const condition of medicalConditions) {
      if (allText.includes(condition) && !validContent.includes(condition)) {
        errors.push(`Medical condition "${condition}" mentioned but not in source data`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
    
  } catch (error) {
    return {
      isValid: false,
      errors: ['Failed to parse LLM response as JSON']
    };
  }
}

function parseStructuredSummary(summaryText: string, sources: any[]) {
  console.log('🔍 PARSING: Starting to parse summary text');
  console.log('🔍 PARSING: First 200 chars:', summaryText.substring(0, 200));
  
  try {
    // Try to parse as JSON first
    const jsonResponse = JSON.parse(summaryText);
    console.log('🔍 PARSING: Successfully parsed as JSON');
    
    // Validate that it has the expected structure
    if (jsonResponse && typeof jsonResponse === 'object') {
      console.log('🔍 PARSING: JSON has valid structure');
      return {
        currentSituation: jsonResponse.currentSituation || {},
        mainConcerns: jsonResponse.mainConcerns || {},
        medicalBackground: jsonResponse.medicalBackground || {},
        aiDiagnosis: jsonResponse.aiDiagnosis || {},
        aiSuggestions: jsonResponse.aiSuggestions || {},
        citations: sources
      };
    }
  } catch (error) {
    console.log('🔍 PARSING: Failed to parse as JSON:', error.message);
    console.log('🔍 PARSING: Trying text extraction...');
  }

  // Fallback: try to extract JSON from the response if it's wrapped in other text
  try {
    console.log('🔍 PARSING: Trying to extract JSON from text...');
    // Look for JSON object in the response - try multiple patterns
    let jsonMatch = summaryText.match(/\{[\s\S]*\}/);
    
    // If no match, try to find JSON after "```json" or similar markers
    if (!jsonMatch) {
      jsonMatch = summaryText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonMatch = [jsonMatch[1]]; // Use the captured group
      }
    }
    
    // If still no match, try to find the first complete JSON object
    if (!jsonMatch) {
      const lines = summaryText.split('\n');
      let jsonStart = -1;
      let jsonEnd = -1;
      let braceCount = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('{')) {
          jsonStart = i;
          braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
          if (braceCount === 0) {
            jsonMatch = [line];
            break;
          }
        } else if (jsonStart !== -1) {
          braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
          if (braceCount === 0) {
            jsonEnd = i;
            jsonMatch = [lines.slice(jsonStart, jsonEnd + 1).join('\n')];
            break;
          }
        }
      }
    }
    
    if (jsonMatch) {
      console.log('🔍 PARSING: Found JSON match:', jsonMatch[0].substring(0, 100) + '...');
      const jsonResponse = JSON.parse(jsonMatch[0]);
      console.log('🔍 PARSING: Successfully parsed extracted JSON');
      return {
        currentSituation: jsonResponse.currentSituation || {},
        mainConcerns: jsonResponse.mainConcerns || {},
        medicalBackground: jsonResponse.medicalBackground || {},
        aiDiagnosis: jsonResponse.aiDiagnosis || {},
        aiSuggestions: jsonResponse.aiSuggestions || {},
        citations: sources
      };
    }
  } catch (error) {
    console.log('🔍 PARSING: Failed to extract JSON from text:', error.message);
  }

  // Final fallback: return empty structure
  console.log('Using fallback structure for summary');
  return {
    currentSituation: {},
    mainConcerns: {},
    medicalBackground: {},
    aiDiagnosis: {},
    aiSuggestions: {},
    citations: sources
  };
}

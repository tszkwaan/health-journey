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
    // Create prompt based on form type
    const prompt = createFormPrompt(formType, transcript);

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
          max_tokens: 1000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const result = await response.json();
    const generatedText = result.response || '';

    // Parse the generated text into form data
    return parseFormData(formType, generatedText);
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    // Return default form data if LLM fails
    return getDefaultFormData(formType);
  }
}

function createFormPrompt(formType: string, transcript: string): string {
  const basePrompt = `You are a medical AI assistant helping doctors fill out forms based on consultation transcripts. 

CONSULTATION TRANSCRIPT:
${transcript}

INSTRUCTIONS:
- Extract relevant information from the transcript
- Fill in the form fields with appropriate medical data
- Use medical terminology appropriately
- If information is not available, use "Not specified" or leave empty
- Return ONLY a JSON object with the form data

FORM TYPE: ${formType}

`;

  switch (formType) {
    case 'clinician_summary':
      return basePrompt + `
Generate a JSON object for a Clinician Summary with these fields:
{
  "patientName": "Patient's full name",
  "dateOfBirth": "YYYY-MM-DD format",
  "mrn": "Medical record number if mentioned",
  "dateOfVisit": "Today's date in YYYY-MM-DD format",
  "provider": "Doctor's name",
  "chiefComplaint": "Primary reason for visit",
  "historyOfPresentIllness": "Detailed description of current symptoms and their progression",
  "pastMedicalHistory": "Relevant past medical conditions",
  "medications": "Current medications and dosages",
  "allergies": "Known allergies and reactions",
  "socialHistory": "Smoking, alcohol, occupation, etc.",
  "physicalExam": "Key physical examination findings",
  "assessment": "Clinical assessment and differential diagnosis",
  "plan": "Treatment plan including medications, procedures, and recommendations",
  "followUp": "Follow-up schedule and next steps",
  "signature": "Provider signature placeholder"
}`;

    case 'patient_summary':
      return basePrompt + `
Generate a JSON object for a Patient Summary with these fields. Use a professional but friendly, easy-to-understand tone:
{
  "patientName": "Patient's full name",
  "date": "Today's date in YYYY-MM-DD format",
  "diagnosis": "Your diagnosis in simple, clear terms",
  "medications": "Your medications with clear names and purposes",
  "instructions": "How to take your medications (when, how often, with food, etc.)",
  "homeCare": "What you can do at home to help with your condition",
  "recovery": "What to expect during your recovery and how to take care of yourself",
  "followUp": "When to come back for your next appointment",
  "warningSigns": "Signs and symptoms to watch out for that need immediate attention",
  "whenToSeekHelp": "When and how to contact your doctor or seek emergency care",
  "contactInfo": "How to reach your doctor's office for questions or concerns"
}`;

    default:
      return basePrompt + `Generate appropriate form data for ${formType} based on the transcript.`;
  }
}

function parseFormData(formType: string, generatedText: string): Record<string, any> {
  try {
    // Try to extract JSON from the response
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonString = jsonMatch[0];
      console.log('Attempting to parse JSON:', jsonString.substring(0, 200) + '...');
      
      // Try to fix common JSON issues
      let cleanedJson = jsonString
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes around unquoted keys
        .replace(/:(\s*)([^",{\[\s][^,}\]]*?)(\s*[,}])/g, ': "$2"$3'); // Add quotes around unquoted string values
      
      return JSON.parse(cleanedJson);
    }
  } catch (error) {
    console.error('Error parsing generated form data:', error);
    console.log('Raw generated text:', generatedText);
  }

  // Fallback to default data
  return getDefaultFormData(formType);
}

function getDefaultFormData(formType: string): Record<string, any> {
  const today = new Date().toISOString().split('T')[0];

  switch (formType) {
    case 'clinician_summary':
      return {
        patientName: 'Patient Name',
        dateOfBirth: '',
        mrn: '',
        dateOfVisit: today,
        provider: 'Dr. Smith',
        chiefComplaint: '',
        historyOfPresentIllness: '',
        pastMedicalHistory: '',
        medications: '',
        allergies: '',
        socialHistory: '',
        physicalExam: '',
        assessment: '',
        plan: '',
        followUp: '',
        signature: ''
      };

    case 'patient_summary':
      return {
        patientName: 'Patient Name',
        date: today,
        diagnosis: '',
        medications: '',
        instructions: '',
        homeCare: '',
        recovery: '',
        followUp: '',
        warningSigns: '',
        whenToSeekHelp: '',
        contactInfo: ''
      };

    default:
      return {};
  }
}

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { formType, transcript, reservationId } = await request.json();

    if (!formType || !transcript) {
      return NextResponse.json({ error: 'Form type and transcript are required' }, { status: 400 });
    }

    // Generate form data using LLM based on transcript
    const formData = await generateFormData(formType, transcript);

    return NextResponse.json(formData);
  } catch (error) {
    console.error('Error generating form data:', error);
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
    case 'diagnosis':
      return basePrompt + `
Generate a JSON object for a Diagnosis & Treatment Form with these fields:
{
  "patientName": "Patient's full name",
  "dateOfBirth": "YYYY-MM-DD format",
  "mrn": "Medical record number if mentioned",
  "dateOfVisit": "Today's date in YYYY-MM-DD format",
  "provider": "Doctor's name",
  "diagnoses": [
    {
      "icd10": "ICD-10 code if determinable",
      "diagnosis": "Primary diagnosis description",
      "notes": "Additional details"
    }
  ],
  "treatments": [
    {
      "type": "Physical exam, Injection, Other, Vaccination, or Counseling",
      "description": "Details of treatment provided"
    }
  ],
  "followUp": "Follow-up plan and recommendations",
  "signature": "Provider signature placeholder"
}`;

    case 'prescription':
      return basePrompt + `
Generate a JSON object for a Prescription Form with these fields:
{
  "patientName": "Patient's full name",
  "dateOfBirth": "YYYY-MM-DD format",
  "date": "Today's date in YYYY-MM-DD format",
  "address": "Patient address if mentioned",
  "drugName": "Medication name if prescribed",
  "strength": "Dosage strength",
  "form": "Tablet, Capsule, Syrup, Injection, or Other",
  "directions": "Dosage instructions (Sig)",
  "quantity": "Number of units",
  "refills": "Number of refills allowed",
  "instructions": "Special instructions or warnings"
}`;

    case 'treatment_plan':
      return basePrompt + `
Generate a JSON object for a Treatment Plan with these fields:
{
  "patientName": "Patient's full name",
  "date": "Today's date in YYYY-MM-DD format",
  "diagnosis": "Primary diagnosis",
  "treatmentGoals": "Specific treatment objectives",
  "medications": "Prescribed medications and dosages",
  "lifestyle": "Lifestyle recommendations",
  "followUp": "Follow-up schedule and appointments",
  "notes": "Additional clinical notes"
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
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Error parsing generated form data:', error);
  }

  // Fallback to default data
  return getDefaultFormData(formType);
}

function getDefaultFormData(formType: string): Record<string, any> {
  const today = new Date().toISOString().split('T')[0];

  switch (formType) {
    case 'diagnosis':
      return {
        patientName: 'Patient Name',
        dateOfBirth: '',
        mrn: '',
        dateOfVisit: today,
        provider: 'Dr. Smith',
        diagnoses: [{ icd10: '', diagnosis: '', notes: '' }],
        treatments: [{ type: 'Physical exam', description: '' }],
        followUp: '',
        signature: ''
      };

    case 'prescription':
      return {
        patientName: 'Patient Name',
        dateOfBirth: '',
        date: today,
        address: '',
        drugName: '',
        strength: '',
        form: 'Tablet',
        directions: '',
        quantity: '',
        refills: '',
        instructions: ''
      };

    case 'treatment_plan':
      return {
        patientName: 'Patient Name',
        date: today,
        diagnosis: '',
        treatmentGoals: '',
        medications: '',
        lifestyle: '',
        followUp: '',
        notes: ''
      };

    default:
      return {};
  }
}

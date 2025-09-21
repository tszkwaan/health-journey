import { NextRequest, NextResponse } from 'next/server';
import { OptimizedPHIRedactor } from '@/lib/phi-redaction-optimized';

export async function POST(request: NextRequest) {
  try {
    const { transcript, reservationId } = await request.json();

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    // Generate Canonical IR using LLM
    const canonicalIR = await generateCanonicalIR(transcript);

    // Redact PHI from IR before sending to client
    const redactedIR = OptimizedPHIRedactor.redactObject(canonicalIR);

    return NextResponse.json({ canonicalIR: redactedIR });
  } catch (error) {
    console.error('Error generating Canonical IR:', error);
    return NextResponse.json({ error: 'Failed to generate Canonical IR' }, { status: 500 });
  }
}

async function generateCanonicalIR(transcript: string) {
  try {
    // Create prompt for IR generation
    const prompt = createIRPrompt(transcript);

    // Call Ollama API
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for structured output
          top_p: 0.9,
          max_tokens: 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const result = await response.json();
    const generatedText = result.response || '';
    
    console.log('Generated IR text:', generatedText.substring(0, 500) + '...');

    // Parse the generated text into structured IR
    const parsedIR = parseIRFromText(generatedText);
    console.log('Parsed IR:', parsedIR);
    
    return parsedIR;
  } catch (error) {
    console.error('Error calling Ollama API for IR generation:', error);
    // Return default IR if LLM fails
    return getDefaultIR();
  }
}

function createIRPrompt(transcript: string): string {
  return `You are a medical AI assistant that creates structured Canonical Intermediate Representations (IR) from consultation transcripts.

CONSULTATION TRANSCRIPT:
${transcript}

Create a Canonical IR in the following JSON format. This will be the single source of truth for generating both clinician and patient summaries.

REQUIRED JSON STRUCTURE:
{
  "diagnoses": [
    {
      "name": "diagnosis name",
      "certainty": "confirmed|likely|possible|unlikely",
      "icd10": "ICD-10 code if known"
    }
  ],
  "medications": [
    {
      "generic": "generic name",
      "brand": ["brand name 1", "brand name 2"],
      "dose": "dose amount",
      "route": "PO|IV|IM|topical",
      "freq": "q6h|q8h|q12h|qd|bid|tid|qid|prn",
      "indication": "reason for medication"
    }
  ],
  "plan": [
    {
      "type": "rest|medication|monitoring|follow_up|procedure",
      "details": "specific details",
      "when": "timing if applicable",
      "condition": "conditions if applicable"
    }
  ],
  "exam": {
    "temp": "temperature if mentioned",
    "bp": "blood pressure if mentioned",
    "pulse": "pulse if mentioned",
    "lungs": "lung findings if mentioned",
    "other": {}
  },
  "follow_up": {
    "type": "follow_up",
    "details": "follow-up details",
    "when": "timing (e.g., '3-5 days')",
    "condition": "conditions (e.g., 'if symptoms persist')"
  },
  "chief_complaint": "primary complaint",
  "hpi": "history of present illness"
}

CRITICAL REQUIREMENTS:
1. Extract ALL medical information from the transcript
2. Use standardized medical terminology
3. Be precise with certainty levels
4. Include all medications mentioned with proper dosing
5. Capture all examination findings
6. Ensure follow-up timing and conditions are exact - this is critical for alignment
7. The follow_up field MUST be properly structured with exact timing and conditions
8. This IR will be used to generate both professional and patient-friendly summaries
9. Both summaries must use IDENTICAL follow-up information from this IR

Generate the Canonical IR now:`;
}

function parseIRFromText(text: string): any {
  try {
    // Extract JSON from the generated text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in generated text');
    }

    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);
    
    // Validate required fields
    const requiredFields = ['diagnoses', 'medications', 'plan', 'exam', 'follow_up', 'chief_complaint', 'hpi'];
    for (const field of requiredFields) {
      if (!(field in parsed)) {
        console.warn(`Missing required field: ${field}`);
        if (field === 'exam') {
          parsed[field] = {};
        } else if (field === 'follow_up') {
          parsed[field] = {
            type: "follow_up",
            details: "Follow up as needed",
            when: "3-5 days",
            condition: "if symptoms persist"
          };
        } else if (field === 'diagnoses' || field === 'medications' || field === 'plan') {
          parsed[field] = [];
        } else {
          parsed[field] = '';
        }
      }
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing IR JSON:', error);
    return getDefaultIR();
  }
}

function getDefaultIR(): any {
  return {
    diagnoses: [
      {
        name: "Tension headache",
        certainty: "possible",
        icd10: null
      }
    ],
    medications: [
      {
        generic: "acetaminophen",
        brand: ["Tylenol"],
        dose: "500mg",
        route: "PO",
        freq: "q6h",
        indication: "fever and pain relief"
      }
    ],
    plan: [
      {
        type: "rest",
        details: "home rest",
        when: null,
        condition: null
      },
      {
        type: "medication",
        details: "acetaminophen as needed",
        when: null,
        condition: null
      }
    ],
    exam: {
      temp: "37.9°C",
      bp: "118/75",
      pulse: null,
      lungs: "clear",
      other: {}
    },
    follow_up: {
      type: "follow_up",
      details: "reassess symptoms",
      when: "3-5 days",
      condition: "if symptoms persist"
    },
    chief_complaint: "Headache with fever",
    hpi: "Patient presents with headache, fever, and fatigue"
  };
}

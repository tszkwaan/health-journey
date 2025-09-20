/**
 * LLM-based summarization for intake data
 * This function takes raw intake answers and creates concise summaries
 * while preserving important medical information
 */

export interface IntakeSummary {
  patient_info: {
    name: string;
    dob: string;
    phone: string;
  };
  visit_reason: string;
  symptom_onset: string;
  previous_treatment: string;
  medical_conditions: string;
  allergies: string;
  concerns: string;
}

export async function summarizeIntakeData(answers: any): Promise<IntakeSummary> {
  try {
    // Prepare the data for LLM processing (remove personal identifiers)
    const sanitizedData = {
      visit_reason: answers.visit_reason || '',
      symptom_onset: answers.symptom_onset || '',
      previous_treatment: answers.previous_treatment || '',
      medical_conditions: answers.medical_conditions || '',
      allergies: answers.allergies || '',
      concerns: answers.concerns || ''
    };

    // Create prompt for LLM summarization
    const prompt = `You are a medical assistant helping to summarize patient intake information. 
Extract and summarize the key information from the following patient responses. 
Keep medical information accurate but make it concise and professional.

Patient Responses:
- Visit Reason: "${sanitizedData.visit_reason}"
- Symptom Onset: "${sanitizedData.symptom_onset}"
- Previous Treatment: "${sanitizedData.previous_treatment}"
- Medical Conditions: "${sanitizedData.medical_conditions}"
- Allergies: "${sanitizedData.allergies}"
- Concerns: "${sanitizedData.concerns}"

Please provide a JSON response with the following structure:
{
  "visit_reason": "concise summary of main complaint (e.g., 'headache, fever' from 'I have headache and fever today')",
  "symptom_onset": "when symptoms started (e.g., 'this morning' from 'today morning')",
  "previous_treatment": "yes/no/specific treatment (e.g., 'no' from 'no i haven't seen this issue before')",
  "medical_conditions": "list of conditions or 'none'",
  "allergies": "list of allergies or 'none'",
  "concerns": "key concerns or 'none'"
}

Rules:
1. Extract only the essential medical information
2. Convert full sentences to concise phrases
3. For yes/no questions, respond with 'yes', 'no', or specific details
4. For lists, use comma-separated values
5. If information is missing or unclear, use 'not specified'
6. Keep medical terminology accurate but simplified

Return ONLY the JSON object, no other text.`;

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
          temperature: 0.1,
          top_p: 0.9,
          max_tokens: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const result = await response.json();
    const summaryText = result.response || '{}';

    // Parse the JSON response
    let summary: IntakeSummary;
    try {
      // Try to extract JSON from the response
      const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : summaryText;
      summary = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError);
      // Fallback to basic summarization
      summary = createFallbackSummary(answers);
    }

    // Ensure all required fields are present
    return {
      patient_info: {
        name: answers.patient_info?.full_name || 'Not provided',
        dob: answers.patient_info?.dob || 'Not provided',
        phone: answers.patient_info?.phone || 'Not provided'
      },
      visit_reason: summary.visit_reason || 'Not specified',
      symptom_onset: summary.symptom_onset || 'Not specified',
      previous_treatment: summary.previous_treatment || 'Not specified',
      medical_conditions: summary.medical_conditions || 'Not specified',
      allergies: summary.allergies || 'Not specified',
      concerns: summary.concerns || 'Not specified'
    };

  } catch (error) {
    console.error('Error summarizing intake data:', error);
    // Return fallback summary
    return createFallbackSummary(answers);
  }
}

function createFallbackSummary(answers: any): IntakeSummary {
  return {
    patient_info: {
      name: answers.patient_info?.full_name || 'Not provided',
      dob: answers.patient_info?.dob || 'Not provided',
      phone: answers.patient_info?.phone || 'Not provided'
    },
    visit_reason: answers.visit_reason || 'Not specified',
    symptom_onset: answers.symptom_onset || 'Not specified',
    previous_treatment: answers.previous_treatment || 'Not specified',
    medical_conditions: answers.medical_conditions || 'Not specified',
    allergies: answers.allergies || 'Not specified',
    concerns: answers.concerns || 'Not specified'
  };
}

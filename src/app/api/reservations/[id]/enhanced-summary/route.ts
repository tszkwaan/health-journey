import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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

    // Check if the reservation belongs to this doctor
    if (reservation.doctorId !== user.doctorProfile.id) {
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

    // Update the medical background with the enhanced summary
    await prisma.medicalBackground.update({
      where: { id: medicalBackground.id },
      data: { enhancedSummary: enhancedSummary }
    });

    console.log('Enhanced summary generated successfully');

    return NextResponse.json({ enhancedSummary });

  } catch (error) {
    console.error('Error generating enhanced summary:', error);
    return NextResponse.json({ error: 'Failed to generate enhanced summary' }, { status: 500 });
  }
}

async function generateEnhancedSummary(medicalBackground: any, intakeAnswers: any, patient: any) {
  try {
    // Prepare source data with citations
    const sources = prepareSourceData(medicalBackground, intakeAnswers, patient);
    
    // Create comprehensive prompt for the LLM
    const prompt = createEnhancedSummaryPrompt(sources);

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

    // Parse the LLM response into structured sections
    const structuredSummary = parseStructuredSummary(summaryText, sources);

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

  // Patient Information
  if (intakeAnswers.patient_info) {
    sources.push({
      id: citationId++,
      type: 'intake',
      section: 'Patient Information',
      content: `Name: ${intakeAnswers.patient_info.full_name || 'Not provided'}, DOB: ${intakeAnswers.patient_info.dob || 'Not provided'}, Phone: ${intakeAnswers.patient_info.phone || 'Not provided'}`,
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

function createEnhancedSummaryPrompt(sources: any[]) {
  let prompt = `You are a medical AI assistant helping doctors prepare for patient consultations. Generate a comprehensive summary based on the provided patient data. Use citation numbers [1], [2], etc. to reference specific sources.

PATIENT DATA SOURCES:
`;

  sources.forEach((source, index) => {
    prompt += `\n[${index + 1}] ${source.section}: ${source.content} (Source: ${source.source})`;
  });

  prompt += `\n\nPlease generate a structured summary with the following sections:

1. CURRENT SITUATION
   - Summarize the patient's current condition and presenting symptoms
   - Include timing, severity, and any relevant details
   - Use citations [1], [2], etc. to reference specific sources

2. MAIN CONCERNS
   - List the primary concerns and symptoms
   - Highlight any urgent or concerning symptoms
   - Use citations to support each concern

3. MEDICAL BACKGROUND SUMMARY
   - Summarize relevant past medical history
   - Include current medications and their purposes
   - Mention allergies and family history
   - Use citations to reference medical history sources

4. AI DIAGNOSIS
   - Analyze possible reasons for the current symptoms
   - Consider differential diagnoses based on the information provided
   - Be cautious and note limitations of the available information
   - Use citations to support diagnostic reasoning

5. AI SUGGESTIONS
   - Suggest follow-up questions for the doctor to ask
   - Recommend next steps for the consultation
   - Suggest any additional tests or examinations that might be helpful
   - Use citations to support recommendations

IMPORTANT:
- Always use citation numbers [1], [2], etc. when referencing specific information
- Be factual and avoid speculation beyond what the data supports
- If information is missing, clearly state what is unknown
- Focus on actionable insights for the doctor
- Keep each section concise but comprehensive

Generate the summary now:`;

  return prompt;
}

function parseStructuredSummary(summaryText: string, sources: any[]) {
  // Parse the LLM response into structured sections
  const sections = {
    currentSituation: '',
    mainConcerns: '',
    medicalBackground: '',
    aiDiagnosis: '',
    aiSuggestions: '',
    citations: sources
  };

  // Extract each section using regex
  const sectionRegex = /(\d+\.\s*(?:CURRENT SITUATION|MAIN CONCERNS|MEDICAL BACKGROUND SUMMARY|AI DIAGNOSIS|AI SUGGESTIONS)[\s\S]*?)(?=\d+\.\s*(?:CURRENT SITUATION|MAIN CONCERNS|MEDICAL BACKGROUND SUMMARY|AI DIAGNOSIS|AI SUGGESTIONS)|$)/gi;
  
  let match;
  while ((match = sectionRegex.exec(summaryText)) !== null) {
    const sectionText = match[1];
    const sectionTitle = sectionText.match(/(\d+\.\s*(?:CURRENT SITUATION|MAIN CONCERNS|MEDICAL BACKGROUND SUMMARY|AI DIAGNOSIS|AI SUGGESTIONS))/i);
    
    if (sectionTitle) {
      const title = sectionTitle[1].toLowerCase();
      const content = sectionText.replace(sectionTitle[0], '').trim();
      
      if (title.includes('current situation')) {
        sections.currentSituation = content;
      } else if (title.includes('main concerns')) {
        sections.mainConcerns = content;
      } else if (title.includes('medical background')) {
        sections.medicalBackground = content;
      } else if (title.includes('ai diagnosis')) {
        sections.aiDiagnosis = content;
      } else if (title.includes('ai suggestions')) {
        sections.aiSuggestions = content;
      }
    }
  }

  // If parsing failed, return the raw text in currentSituation
  if (!sections.currentSituation && !sections.mainConcerns) {
    sections.currentSituation = summaryText;
  }

  return sections;
}

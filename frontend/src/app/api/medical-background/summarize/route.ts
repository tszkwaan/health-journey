import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a patient
    if ((session.user as any)?.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { medicalBackgroundId } = await request.json();

    if (!medicalBackgroundId) {
      return NextResponse.json({ error: 'Medical background ID is required' }, { status: 400 });
    }

    // Get the medical background record
    const medicalBackground = await prisma.medicalBackground.findUnique({
      where: { id: medicalBackgroundId },
      include: {
        versions: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!medicalBackground) {
      return NextResponse.json({ error: 'Medical background not found' }, { status: 404 });
    }

    // Generate summary using LLM
    const summary = await generateMedicalHistorySummary(medicalBackground);

    // Update the medical background with the summary
    await prisma.medicalBackground.update({
      where: { id: medicalBackgroundId },
      data: { llmSummary: summary }
    });

    return NextResponse.json({ summary });

  } catch (error) {
    console.error('Error generating medical history summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate medical history summary' },
      { status: 500 }
    );
  }
}

async function generateMedicalHistorySummary(medicalBackground: any): Promise<string> {
  try {
    // Prepare the medical history data for LLM
    const medicalData = {
      current: {
        pastMedicalConditions: medicalBackground.pastMedicalConditions || [],
        otherMedicalCondition: medicalBackground.otherMedicalCondition,
        surgicalHistory: medicalBackground.surgicalHistory || [],
        medications: medicalBackground.medications || [],
        allergies: medicalBackground.allergies || [],
        otherAllergy: medicalBackground.otherAllergy,
        familyHistory: medicalBackground.familyHistory || [],
        otherFamilyHistory: medicalBackground.otherFamilyHistory,
        smoking: medicalBackground.smoking,
        alcohol: medicalBackground.alcohol,
        exerciseFrequency: medicalBackground.exerciseFrequency,
        occupation: medicalBackground.occupation,
        menstrualCycle: medicalBackground.menstrualCycle,
        menopause: medicalBackground.menopause,
        pregnancyHistory: medicalBackground.pregnancyHistory || [],
        contraceptives: medicalBackground.contraceptives || [],
        immunizations: medicalBackground.immunizations || [],
        otherImmunization: medicalBackground.otherImmunization
      },
      history: medicalBackground.versions.map((version: any) => ({
        version: version.data.version,
        createdAt: version.createdAt,
        data: version.data
      }))
    };

    // Create a comprehensive prompt for the LLM
    const prompt = createMedicalHistoryPrompt(medicalData);

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
    return result.response || 'Unable to generate summary at this time.';

  } catch (error) {
    console.error('Error calling Ollama API:', error);
    return 'Summary generation temporarily unavailable.';
  }
}

function createMedicalHistoryPrompt(medicalData: any): string {
  const { current, history } = medicalData;
  
  let prompt = `Please provide a comprehensive medical history summary for a patient. Focus on key medical information that would be relevant for healthcare providers.

CURRENT MEDICAL INFORMATION:
`;

  // Past Medical Conditions
  if (current.pastMedicalConditions?.length > 0 || current.otherMedicalCondition) {
    prompt += `\nPast Medical Conditions: ${current.pastMedicalConditions?.join(', ') || ''}`;
    if (current.otherMedicalCondition) {
      prompt += `, ${current.otherMedicalCondition}`;
    }
  }

  // Surgical History
  if (current.surgicalHistory?.length > 0) {
    prompt += `\nSurgical History:`;
    current.surgicalHistory.forEach((surgery: any) => {
      prompt += `\n- ${surgery.year}: ${surgery.type} - ${surgery.reason}`;
    });
  }

  // Medications
  if (current.medications?.length > 0) {
    prompt += `\nCurrent Medications:`;
    current.medications.forEach((med: any) => {
      prompt += `\n- ${med.name}: ${med.dosage} ${med.frequency}`;
    });
  }

  // Allergies
  if (current.allergies?.length > 0 || current.otherAllergy) {
    prompt += `\nAllergies: ${current.allergies?.map((a: any) => `${a.type} (${a.reaction})`).join(', ') || ''}`;
    if (current.otherAllergy) {
      prompt += `, ${current.otherAllergy}`;
    }
  }

  // Family History
  if (current.familyHistory?.length > 0 || current.otherFamilyHistory) {
    prompt += `\nFamily History: ${current.familyHistory?.join(', ') || ''}`;
    if (current.otherFamilyHistory) {
      prompt += `, ${current.otherFamilyHistory}`;
    }
  }

  // Lifestyle
  if (current.smoking?.smokes || current.alcohol?.drinks || current.exerciseFrequency || current.occupation) {
    prompt += `\nLifestyle:`;
    if (current.smoking?.smokes) {
      prompt += `\n- Smoking: ${current.smoking.packsPerDay || 'Unknown'} packs/day for ${current.smoking.yearsSmoked || 'Unknown'} years`;
    }
    if (current.alcohol?.drinks) {
      prompt += `\n- Alcohol: ${current.alcohol.type || 'Unknown'} ${current.alcohol.frequency || 'Unknown frequency'}`;
    }
    if (current.exerciseFrequency) {
      prompt += `\n- Exercise: ${current.exerciseFrequency}`;
    }
    if (current.occupation) {
      prompt += `\n- Occupation: ${current.occupation}`;
    }
  }

  // Reproductive Health
  if (current.menstrualCycle || current.menopause || current.pregnancyHistory?.length > 0 || current.contraceptives?.length > 0) {
    prompt += `\nReproductive Health:`;
    if (current.menstrualCycle) {
      prompt += `\n- Menstrual Cycle: ${current.menstrualCycle}`;
    }
    if (current.menopause) {
      prompt += `\n- Menopause: ${current.menopause}`;
    }
    if (current.pregnancyHistory?.length > 0) {
      prompt += `\n- Pregnancy History:`;
      current.pregnancyHistory.forEach((preg: any) => {
        prompt += `\n  ${preg.year}: ${preg.type}`;
      });
    }
    if (current.contraceptives?.length > 0) {
      prompt += `\n- Contraceptives: ${current.contraceptives.join(', ')}`;
    }
  }

  // Immunizations
  if (current.immunizations?.length > 0 || current.otherImmunization) {
    prompt += `\nImmunizations: ${current.immunizations?.map((imm: any) => imm.type).join(', ') || ''}`;
    if (current.otherImmunization) {
      prompt += `, ${current.otherImmunization}`;
    }
  }

  // Historical Changes
  if (history.length > 0) {
    prompt += `\n\nHISTORICAL CHANGES:`;
    history.forEach((version: any, index: number) => {
      if (index > 0) { // Skip the first version as it's the same as current
        prompt += `\n\nVersion ${version.version} (${new Date(version.createdAt).toLocaleDateString()}):`;
        // Add key changes from this version
        const versionData = version.data;
        if (versionData.pastMedicalConditions?.length !== current.pastMedicalConditions?.length) {
          prompt += `\n- Medical conditions updated`;
        }
        if (versionData.medications?.length !== current.medications?.length) {
          prompt += `\n- Medications updated`;
        }
        if (versionData.smoking?.smokes !== current.smoking?.smokes) {
          prompt += `\n- Smoking status changed`;
        }
        // Add more change detection as needed
      }
    });
  }

  prompt += `\n\nPlease provide a concise but comprehensive summary that highlights:
1. Key medical conditions and their current status
2. Important surgical procedures and their dates
3. Current medications and their purposes
4. Critical allergies and reactions
5. Significant family history
6. Relevant lifestyle factors
7. Any notable changes in medical history over time

Format the summary in a clear, professional manner suitable for healthcare providers.`;

  return prompt;
}

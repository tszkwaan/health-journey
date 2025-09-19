import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

// Create a new Prisma client instance for this API route
const prisma = new PrismaClient();

// Cleanup function
const cleanup = async () => {
  await prisma.$disconnect();
};

// Handle cleanup on process termination
if (typeof process !== 'undefined') {
  process.on('beforeExit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a patient
    if ((session.user as any)?.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get the current medical background for the patient
    const medicalBackground = await prisma.medicalBackground.findFirst({
      where: {
        patientId: session.user.id,
        isCurrent: true
      },
      orderBy: {
        version: 'desc'
      }
    });

    // Return null if no medical background exists (this is normal for new users)
    return NextResponse.json(medicalBackground || null);

  } catch (error) {
    console.error('Error fetching medical background:', error);
    return NextResponse.json(
      { error: 'Failed to fetch medical background' },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    
    // Get the current version number
    const currentVersion = await prisma.medicalBackground.findFirst({
      where: {
        patientId: session.user.id,
        isCurrent: true
      },
      orderBy: {
        version: 'desc'
      }
    });

    const newVersion = (currentVersion?.version || 0) + 1;

    // Mark all previous versions as not current
    await prisma.medicalBackground.updateMany({
      where: {
        patientId: session.user.id,
        isCurrent: true
      },
      data: {
        isCurrent: false
      }
    });

    // Create new medical background record
    const medicalBackground = await prisma.medicalBackground.create({
      data: {
        patientId: session.user.id,
        version: newVersion,
        isCurrent: true,
        pastMedicalConditions: body.pastMedicalConditions || [],
        otherMedicalCondition: body.otherMedicalCondition || null,
        surgicalHistory: body.surgicalHistory || [],
        medications: body.medications || [],
        allergies: body.allergies || [],
        otherAllergy: body.otherAllergy || null,
        familyHistory: body.familyHistory || [],
        otherFamilyHistory: body.otherFamilyHistory || null,
        smoking: body.smoking || null,
        alcohol: body.alcohol || null,
        exerciseFrequency: body.exerciseFrequency || null,
        occupation: body.occupation || null,
        menstrualCycle: body.menstrualCycle || null,
        menopause: body.menopause || null,
        pregnancyHistory: body.pregnancyHistory || [],
        contraceptives: body.contraceptives || [],
        immunizations: body.immunizations || [],
        otherImmunization: body.otherImmunization || null
      }
    });

    // Create version snapshot
    await prisma.medicalBackgroundVersion.create({
      data: {
        medicalBackgroundId: medicalBackground.id,
        data: {
          pastMedicalConditions: body.pastMedicalConditions || [],
          otherMedicalCondition: body.otherMedicalCondition || null,
          surgicalHistory: body.surgicalHistory || [],
          medications: body.medications || [],
          allergies: body.allergies || [],
          otherAllergy: body.otherAllergy || null,
          familyHistory: body.familyHistory || [],
          otherFamilyHistory: body.otherFamilyHistory || null,
          smoking: body.smoking || null,
          alcohol: body.alcohol || null,
          exerciseFrequency: body.exerciseFrequency || null,
          occupation: body.occupation || null,
          menstrualCycle: body.menstrualCycle || null,
          menopause: body.menopause || null,
          pregnancyHistory: body.pregnancyHistory || [],
          contraceptives: body.contraceptives || [],
          immunizations: body.immunizations || [],
          otherImmunization: body.otherImmunization || null
        }
      }
    });

    // Generate LLM summary directly
    try {
      console.log('Generating LLM summary for medical background:', medicalBackground.id);
      
      // Fetch the medical background with versions for summary generation
      const medicalBackgroundWithVersions = await prisma.medicalBackground.findUnique({
        where: { id: medicalBackground.id },
        include: {
          versions: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });
      
      if (medicalBackgroundWithVersions) {
        const summary = await generateMedicalHistorySummary(medicalBackgroundWithVersions);
        
        // Update the medical background with the generated summary
        await prisma.medicalBackground.update({
          where: { id: medicalBackground.id },
          data: { llmSummary: summary }
        });
        
        console.log('LLM summary generated successfully');
      }
    } catch (summaryError) {
      console.error('Error generating summary:', summaryError);
      // Don't fail the main request if summary generation fails
    }

    // Also trigger enhanced summary generation for any associated reservations
    try {
      console.log('Triggering enhanced summary generation for associated reservations...');
      
      // Find reservations for this patient that have completed intake
      const reservations = await prisma.reservation.findMany({
        where: {
          patientId: session.user.id,
          intakeSession: {
            isNot: null
          }
        },
        select: { id: true }
      });

      // Trigger enhanced summary generation for each reservation
      for (const reservation of reservations) {
        try {
          const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/reservations/${reservation.id}/enhanced-summary`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            console.log(`Enhanced summary generated for reservation ${reservation.id}`);
          } else {
            console.error(`Failed to generate enhanced summary for reservation ${reservation.id}:`, response.statusText);
          }
        } catch (error) {
          console.error(`Error generating enhanced summary for reservation ${reservation.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error triggering enhanced summary generation:', error);
      // Don't fail the main request if enhanced summary generation fails
    }

    return NextResponse.json(medicalBackground);

  } catch (error) {
    console.error('Error saving medical background:', error);
    return NextResponse.json(
      { error: 'Failed to save medical background' },
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
      history: medicalBackground.versions?.map((version: any) => ({
        version: version.data.version,
        createdAt: version.createdAt,
        data: version.data
      })) || []
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

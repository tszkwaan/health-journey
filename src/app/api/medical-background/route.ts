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

    return NextResponse.json(medicalBackground);

  } catch (error) {
    console.error('Error saving medical background:', error);
    return NextResponse.json(
      { error: 'Failed to save medical background' },
      { status: 500 }
    );
  }
}

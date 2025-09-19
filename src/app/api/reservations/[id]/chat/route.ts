import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { RAGService } from '@/lib/rag/ragService';

// Global RAG service instance
const ragService = new RAGService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: reservationId } = await params;
    const { message, includeExternal = false } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
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

    // Check if the reservation belongs to this doctor
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { doctorId: true }
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (reservation.doctorId !== user.doctorProfile.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch patient data for RAG
    const patientData = await prisma.reservation.findUnique({
      where: { id: reservationId },
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
                llmSummary: true,
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

    if (!patientData) {
      return NextResponse.json({ error: 'Patient data not found' }, { status: 404 });
    }

    // Transform the data to match the expected structure for RAG processing
    const transformedPatientData = {
      ...patientData,
      medicalBackground: patientData.patient.medicalBackgrounds[0] || null
    };

    // Process patient data for RAG (always reprocess to ensure latest data)
    await ragService.processReservationData(reservationId, transformedPatientData);

    // Generate RAG response
    const ragResponse = await ragService.generateResponse(message, reservationId, includeExternal);

    return NextResponse.json(ragResponse);

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: (error as Error).message },
      { status: 500 }
    );
  }
}

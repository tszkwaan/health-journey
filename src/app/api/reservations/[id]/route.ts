import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(
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
        timeSlot: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true
          }
        },
        intakeSession: {
          select: {
            id: true,
            progress: true,
            answers: true,
            completeTranscript: true,
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

    // Transform the data to include medical background in the expected format
    const transformedReservation = {
      ...reservation,
      medicalBackground: reservation.patient.medicalBackgrounds[0] || null
    };

    return NextResponse.json(transformedReservation);

  } catch (error) {
    console.error('Error fetching reservation:', error);
    return NextResponse.json({ error: 'Failed to fetch reservation' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

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
      where: { id },
      select: { doctorId: true }
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (reservation.doctorId !== user.doctorProfile.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update the reservation
    const updatedReservation = await prisma.reservation.update({
      where: { id },
      data: {
        status: body.status,
        notes: body.notes
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        timeSlot: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true
          }
        },
        intakeSession: {
          select: {
            id: true,
            progress: true,
            answers: true,
            completeTranscript: true,
          }
        }
      }
    });

    return NextResponse.json(updatedReservation);

  } catch (error) {
    console.error('Error updating reservation:', error);
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
  }
}
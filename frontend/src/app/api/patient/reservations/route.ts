import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user to check if they're a patient
    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
    });

    if (!user || user.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Patient profile not found' }, { status: 403 });
    }

    // Fetch reservations for this patient
    const reservations = await prisma.reservation.findMany({
      where: {
        patientId: user.id,
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialization: true,
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
            answers: true
          }
        }
      },
      orderBy: {
        timeSlot: {
          date: 'asc'
        }
      }
    });

    return NextResponse.json(reservations);

  } catch (error) {
    console.error('Error fetching patient reservations:', error);
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
  }
}

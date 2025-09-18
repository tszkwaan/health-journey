import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a doctor
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { doctorProfile: true }
    });

    if (!user || user.role !== 'DOCTOR' || !user.doctorProfile) {
      return NextResponse.json({ error: 'Doctor profile not found' }, { status: 403 });
    }

    const doctorId = user.doctorProfile.id;
    // Get today's date as string for comparison
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    // Fetch appointments with patient and time slot details
    const appointments = await prisma.reservation.findMany({
      where: {
        doctorId: doctorId,
        status: {
          in: ['PENDING', 'CONFIRMED']
        },
        timeSlot: {
          date: {
            gte: new Date(todayStr + 'T00:00:00.000Z')
          }
        }
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
            progress: true
          }
        }
      },
      orderBy: {
        timeSlot: {
          date: 'asc'
        }
      }
    });

    // Categorize appointments by date
    const appointmentsByDate = {
      today: [] as any[],
      tomorrow: [] as any[],
      nextWeek: [] as any[]
    };

    appointments.forEach(appointment => {
      const appointmentDate = new Date(appointment.timeSlot.date);
      const appointmentDateStr = appointmentDate.toISOString().split('T')[0];

      if (appointmentDateStr === todayStr) {
        appointmentsByDate.today.push(appointment);
      } else if (appointmentDateStr === tomorrowStr) {
        appointmentsByDate.tomorrow.push(appointment);
      } else if (appointmentDateStr >= tomorrowStr && appointmentDateStr < nextWeekStr) {
        appointmentsByDate.nextWeek.push(appointment);
      }
    });

    return NextResponse.json(appointmentsByDate);

  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

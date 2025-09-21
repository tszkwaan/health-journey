import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createReservation, getReservations } from '@/lib/reservation';
import { CreateReservationRequest, GetReservationsRequest } from '@/types/reservation';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateReservationRequest = await request.json();
    const { doctorId, timeSlotId, notes } = body;

    if (!doctorId || !timeSlotId) {
      return NextResponse.json(
        { error: 'Doctor ID and Time Slot ID are required' },
        { status: 400 }
      );
    }

    const reservation = await createReservation(session.user.id, {
      doctorId,
      timeSlotId,
      notes
    });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    console.error('Error creating reservation:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create reservation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filters: GetReservationsRequest = {};

    // Get filters from query parameters
    const patientId = searchParams.get('patientId');
    const doctorId = searchParams.get('doctorId');
    const status = searchParams.get('status');
    const date = searchParams.get('date');

    // For patients, only show their own reservations
    if (session.user.role === 'PATIENT') {
      filters.patientId = session.user.id;
    } else if (patientId) {
      filters.patientId = patientId;
    }

    if (doctorId) filters.doctorId = doctorId;
    if (status) filters.status = status as any;
    if (date) filters.date = date;

    const reservations = await getReservations(filters);

    return NextResponse.json({ reservations });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reservations' },
      { status: 500 }
    );
  }
}

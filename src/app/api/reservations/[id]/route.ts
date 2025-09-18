import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { updateReservation, cancelReservation, linkIntakeSessionToReservation } from '@/lib/reservation';
import { ReservationStatus } from '@prisma/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { status, notes, intakeSessionId } = body;

    // Validate status if provided
    if (status && !Object.values(ReservationStatus).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid reservation status' },
        { status: 400 }
      );
    }

    // Handle linking intake session
    if (intakeSessionId) {
      const reservation = await linkIntakeSessionToReservation(id, intakeSessionId);
      return NextResponse.json({ reservation });
    }

    // Handle status/notes update
    const updates: any = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    const reservation = await updateReservation(id, updates);

    return NextResponse.json({ reservation });
  } catch (error) {
    console.error('Error updating reservation:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update reservation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const reservation = await cancelReservation(id);

    return NextResponse.json({ reservation });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to cancel reservation' },
      { status: 500 }
    );
  }
}

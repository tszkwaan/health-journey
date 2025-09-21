import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET - Retrieve all forms for a reservation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: reservationId } = await params;

    // Get the consultation session for this reservation
    const consultationSession = await prisma.consultationSession.findFirst({
      where: {
        reservationId: reservationId
      },
      include: {
        forms: true
      }
    });

    if (!consultationSession) {
      return NextResponse.json([]);
    }

    return NextResponse.json(consultationSession.forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 });
  }
}

// POST - Create or update a form for a reservation
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
    const { formType, formData, isGenerated = false, isCompleted = false } = await request.json();

    if (!formType || !formData) {
      return NextResponse.json({ error: 'Form type and data are required' }, { status: 400 });
    }

    // Get or create consultation session
    let consultationSession = await prisma.consultationSession.findFirst({
      where: { reservationId }
    });

    if (!consultationSession) {
      consultationSession = await prisma.consultationSession.create({
        data: {
          reservationId,
          transcript: {},
          doctorNotes: '',
          isRecording: false
        }
      });
    }

    // Check if form already exists
    const existingForm = await prisma.consultationForm.findFirst({
      where: {
        consultationSessionId: consultationSession.id,
        formType
      }
    });

    let form;
    if (existingForm) {
      // Update existing form
      form = await prisma.consultationForm.update({
        where: { id: existingForm.id },
        data: {
          formData,
          isGenerated,
          isCompleted
        }
      });
    } else {
      // Create new form
      form = await prisma.consultationForm.create({
        data: {
          formType,
          formData,
          isGenerated,
          isCompleted,
          consultationSessionId: consultationSession.id
        }
      });
    }

    // If this is a completed form, update reservation status to COMPLETED
    if (isCompleted) {
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: 'COMPLETED' }
      });
    }

    return NextResponse.json(form);
  } catch (error) {
    console.error('Error saving form:', error);
    return NextResponse.json({ error: 'Failed to save form' }, { status: 500 });
  }
}
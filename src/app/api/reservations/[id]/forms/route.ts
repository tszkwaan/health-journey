import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      where: { id },
      include: { doctor: true }
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (reservation.doctorId !== user.doctorProfile.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { forms } = await request.json();

    if (!forms || !Array.isArray(forms)) {
      return NextResponse.json({ error: 'Forms data is required' }, { status: 400 });
    }

    // Create or update consultation session
    let consultationSession = await prisma.consultationSession.findUnique({
      where: { reservationId: id }
    });

    if (!consultationSession) {
      consultationSession = await prisma.consultationSession.create({
        data: {
          reservationId: id,
          transcript: null,
          isRecording: false,
          startedAt: new Date(),
          endedAt: new Date()
        }
      });
    }

    // Save forms
    const savedForms = [];
    for (const form of forms) {
      const savedForm = await prisma.consultationForm.create({
        data: {
          consultationSessionId: consultationSession.id,
          formType: form.formType,
          formData: form.formData,
          isGenerated: true,
          isCompleted: true
        }
      });
      savedForms.push(savedForm);
    }

    return NextResponse.json({ 
      message: 'Forms saved successfully',
      forms: savedForms 
    });

  } catch (error) {
    console.error('Error saving forms:', error);
    return NextResponse.json({ error: 'Failed to save forms' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      where: { id },
      include: { doctor: true }
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (reservation.doctorId !== user.doctorProfile.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get consultation session and forms
    const consultationSession = await prisma.consultationSession.findUnique({
      where: { reservationId: id },
      include: {
        forms: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!consultationSession) {
      return NextResponse.json({ forms: [] });
    }

    return NextResponse.json({ 
      forms: consultationSession.forms,
      transcript: consultationSession.transcript
    });

  } catch (error) {
    console.error('Error fetching forms:', error);
    return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 });
  }
}

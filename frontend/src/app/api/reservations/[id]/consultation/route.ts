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
    const { id: reservationId } = await params;

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

    const { transcript, transcriptText, doctorNotes, isRecording, startedAt, endedAt } = await request.json();

    // Check if consultation session already exists
    let consultationSession = await prisma.consultationSession.findUnique({
      where: { reservationId }
    });

    if (consultationSession) {
      // Update existing session
      consultationSession = await prisma.consultationSession.update({
        where: { id: consultationSession.id },
        data: {
          transcript: transcript,
          doctorNotes: doctorNotes,
          isRecording: isRecording,
          startedAt: startedAt ? new Date(startedAt) : null,
          endedAt: endedAt ? new Date(endedAt) : null,
        }
      });

      // Update reservation status to CONSULTATION
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: 'CONSULTATION' }
      });
    } else {
      // Create new consultation session
      consultationSession = await prisma.consultationSession.create({
        data: {
          reservationId: reservationId,
          transcript: transcript,
          doctorNotes: doctorNotes,
          isRecording: isRecording,
          startedAt: startedAt ? new Date(startedAt) : null,
          endedAt: endedAt ? new Date(endedAt) : null,
        }
      });

      // Link consultation session to reservation and update status
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { 
          consultationSessionId: consultationSession.id,
          status: 'CONSULTATION'
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      consultationSession,
      message: 'Consultation data saved successfully'
    });

  } catch (error) {
    console.error('Error saving consultation data:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to save consultation data' 
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: reservationId } = await params;

    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get consultation session
    const consultationSession = await prisma.consultationSession.findUnique({
      where: { reservationId },
      include: {
        forms: true,
      },
    });

    if (!consultationSession) {
      return NextResponse.json({ consultationSession: null });
    }

    return NextResponse.json({ consultationSession });

  } catch (error) {
    console.error('Error fetching consultation data:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch consultation data' 
    }, { status: 500 });
  }
}

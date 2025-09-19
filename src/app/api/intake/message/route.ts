import { NextRequest, NextResponse } from 'next/server';
import { processIntakeMessage } from '@/lib/intake/langgraph';
import { MessageIntakeRequest, MessageIntakeResponse } from '@/lib/intake/types';
import { getSession } from '@/lib/intake/state';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest): Promise<NextResponse<MessageIntakeResponse>> {
  try {
    const body: MessageIntakeRequest = await request.json();
    const { sessionId, userText } = body;
    
    // Validate request
    if (!sessionId || !userText) {
      return NextResponse.json(
        {
          sessionId: '',
          current_step: 'patient_info',
          progress: 0,
          utterance: 'Please provide both sessionId and userText.',
          requires_correction: true
        },
        { status: 400 }
      );
    }
    
    // Process message through LangGraph (handles session creation if needed)
    const result = processIntakeMessage(sessionId, userText);
    
    // Update the database record with the latest session state
    const session = getSession(sessionId);
    if (session) {
      // First, try to find existing intake session to preserve reservationId
      const existingSession = await prisma.intakeSession.findUnique({
        where: { sessionId: sessionId }
      });
      
      const intakeSession = await prisma.intakeSession.upsert({
        where: { sessionId: sessionId },
        update: {
          currentStep: session.current_step,
          answers: session.answers,
          flags: session.flags as any,
          progress: session.progress,
          // Preserve existing reservationId if it exists
          reservationId: existingSession?.reservationId || null
        },
        create: {
          sessionId: sessionId,
          currentStep: session.current_step,
          answers: session.answers,
          flags: session.flags as any,
          progress: session.progress,
          reservationId: null // Will be set when starting intake with reservationId
        }
      });

      // If the intake is completed (progress = 100), link it to the reservation
      console.log('🔍 MESSAGE API: Checking completion:', {
        progress: session.progress,
        reservationId: intakeSession.reservationId,
        intakeSessionId: intakeSession.id
      });
      
      if (session.progress === 100 && intakeSession.reservationId) {
        console.log('🔍 MESSAGE API: Linking completed intake to reservation:', intakeSession.reservationId);
        await prisma.reservation.update({
          where: { id: intakeSession.reservationId },
          data: { intakeSessionId: intakeSession.id }
        });
        console.log('🔍 MESSAGE API: Successfully linked intake to reservation');
      }
    }
    
    const response: MessageIntakeResponse = {
      sessionId: result.sessionId,
      current_step: result.current_step,
      progress: result.progress,
      utterance: result.utterance,
      requires_correction: result.requires_correction,
      review_snapshot: result.review_snapshot
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing intake message:', error);
    return NextResponse.json(
      {
        sessionId: '',
        current_step: 'patient_info',
        progress: 0,
        utterance: 'I apologize, but I encountered an error processing your message. Please try again.',
        requires_correction: true
      },
      { status: 500 }
    );
  }
}

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
    
    // First, try to restore session from database if not in memory
    let session = getSession(sessionId);
    if (!session) {
      console.log('🔍 MESSAGE API: Session not in memory, restoring from database...');
      const dbSession = await prisma.intakeSession.findUnique({
        where: { sessionId: sessionId }
      });
      
      if (dbSession) {
        console.log('🔍 MESSAGE API: Found session in database, restoring to memory...');
        // Restore session to memory
        const { createSession } = await import('@/lib/intake/state');
        session = createSession(sessionId);
        session.current_step = dbSession.currentStep as any;
        session.answers = dbSession.answers as any;
        session.flags = dbSession.flags as any;
        session.progress = dbSession.progress;
        console.log('🔍 MESSAGE API: Restored session:', {
          current_step: session.current_step,
          progress: session.progress,
          answers: Object.keys(session.answers)
        });
      }
    }
    
    // Process message through LangGraph (handles session creation if needed)
    const result = processIntakeMessage(sessionId, userText);
    
    // Update the database record with the latest session state
    const updatedSession = getSession(sessionId);
    if (updatedSession) {
      // First, try to find existing intake session to preserve reservationId
      const existingSession = await prisma.intakeSession.findUnique({
        where: { sessionId: sessionId }
      });
      
      const intakeSession = await prisma.intakeSession.upsert({
        where: { sessionId: sessionId },
        update: {
          currentStep: result.current_step, // Use the current_step from the result, not the session
          answers: updatedSession.answers,
          flags: updatedSession.flags as any,
          progress: result.progress, // Use the progress from the result
          // Preserve existing reservationId if it exists
          reservationId: existingSession?.reservationId || null
        },
        create: {
          sessionId: sessionId,
          currentStep: result.current_step, // Use the current_step from the result
          answers: updatedSession.answers,
          flags: updatedSession.flags as any,
          progress: result.progress, // Use the progress from the result
          reservationId: null // Will be set when starting intake with reservationId
        }
      });

      // If the intake is completed (progress = 100), link it to the reservation
      console.log('🔍 MESSAGE API: Checking completion:', {
        progress: result.progress,
        reservationId: intakeSession.reservationId,
        intakeSessionId: intakeSession.id
      });
      
      if (result.progress === 100 && intakeSession.reservationId) {
        console.log('🔍 MESSAGE API: Linking completed intake to reservation:', intakeSession.reservationId);
        await prisma.reservation.update({
          where: { id: intakeSession.reservationId },
          data: { intakeSessionId: intakeSession.id }
        });
        console.log('🔍 MESSAGE API: Successfully linked intake to reservation');

        // Trigger enhanced summary generation after intake completion
        try {
          console.log('🔍 MESSAGE API: Triggering enhanced summary generation...');
          const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/reservations/${intakeSession.reservationId}/enhanced-summary`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            console.log('🔍 MESSAGE API: Enhanced summary generated successfully');
          } else {
            console.error('🔍 MESSAGE API: Failed to generate enhanced summary:', response.statusText);
          }
        } catch (error) {
          console.error('🔍 MESSAGE API: Error generating enhanced summary:', error);
        }
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

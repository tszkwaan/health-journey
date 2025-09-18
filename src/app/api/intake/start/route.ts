import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createSession } from '@/lib/intake/state';
import { generateUtterance } from '@/lib/intake/llm';
import { StartIntakeResponse } from '@/lib/intake/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest): Promise<NextResponse<StartIntakeResponse>> {
  try {
    // Generate new session ID
    const sessionId = uuidv4();
    
    // Create new session in memory
    const session = createSession(sessionId);
    
    // Check if request body contains reservationId
    let reservationId: string | undefined;
    try {
      const body = await request.json();
      reservationId = body.reservationId;
    } catch {
      // No body or invalid JSON, continue without reservationId
    }
    
    // Create database record for the intake session
    await prisma.intakeSession.create({
      data: {
        sessionId: session.sessionId,
        currentStep: session.current_step,
        answers: session.answers,
        flags: session.flags,
        progress: session.progress
      }
    });
    
    // If reservationId is provided, link the intake session to the reservation
    if (reservationId) {
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { intakeSessionId: sessionId }
      });
    }
    
    // Generate initial utterance
    const utterance = generateUtterance('patient_info', 'ask');
    
    const response: StartIntakeResponse = {
      sessionId: session.sessionId,
      current_step: session.current_step,
      progress: session.progress,
      utterance
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error starting intake session:', error);
    return NextResponse.json(
      { 
        sessionId: '',
        current_step: 'patient_info',
        progress: 0,
        utterance: 'I apologize, but I encountered an error. Please try again.'
      },
      { status: 500 }
    );
  }
}

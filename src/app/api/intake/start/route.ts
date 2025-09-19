import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Starting intake session API');
    
    // Generate new session ID
    const sessionId = uuidv4();
    console.log('🔍 DEBUG: Generated sessionId:', sessionId);
    
    // Get reservationId from request
    let reservationId: string | undefined;
    try {
      const body = await request.json();
      reservationId = body.reservationId;
      console.log('🔍 DEBUG: Received reservationId:', reservationId);
    } catch (error) {
      console.log('🔍 DEBUG: No body or invalid JSON:', error);
    }
    
    // Create database record
    console.log('🔍 DEBUG: Creating intake session...');
    const intakeSession = await prisma.intakeSession.create({
      data: {
        sessionId: sessionId,
        currentStep: 'patient_info',
        answers: {},
        flags: { skipped: {}, editMode: false } as any,
        progress: 0,
        reservationId: reservationId || null
      }
    });
    console.log('🔍 DEBUG: Created intake session:', intakeSession.id);
    
    // Link to reservation if provided
    if (reservationId) {
      console.log('🔍 DEBUG: Linking to reservation:', reservationId);
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { intakeSessionId: intakeSession.id }
      });
      console.log('🔍 DEBUG: Linked successfully');
    }
    
    return NextResponse.json({
      sessionId: sessionId,
      current_step: 'patient_info',
      progress: 0,
      utterance: "Hello! I'm here to help you get registered today. Could you please confirm your full name, date of birth, and contact number?"
    });
    
  } catch (error) {
    console.error('❌ Error starting intake session:', error);
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

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Create intake session
    const intake = await prisma.intakeSession.create({
      data: {
        reservationId: data.reservationId,
        patientId: data.patientId,
        answers: data.answers,
        status: data.status || 'COMPLETED',
        completedAt: new Date()
      }
    });
    
    return NextResponse.json(intake);
  } catch (error) {
    console.error('Error creating test intake:', error);
    return NextResponse.json({ error: 'Failed to create intake' }, { status: 500 });
  }
}

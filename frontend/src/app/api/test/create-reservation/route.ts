import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Create reservation
    const reservation = await prisma.reservation.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        appointmentTime: new Date(data.appointmentTime),
        status: data.status || 'PENDING_INTAKE',
        reason: data.reason || 'Test consultation'
      }
    });
    
    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Error creating test reservation:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return NextResponse.json({ 
      error: 'Failed to create reservation', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

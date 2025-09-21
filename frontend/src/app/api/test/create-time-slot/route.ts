import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Create time slot
    const timeSlot = await prisma.timeSlot.create({
      data: {
        doctorId: data.doctorId,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        isAvailable: data.isAvailable || true
      }
    });
    
    return NextResponse.json(timeSlot);
  } catch (error) {
    console.error('Error creating test time slot:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return NextResponse.json({ 
      error: 'Failed to create time slot', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

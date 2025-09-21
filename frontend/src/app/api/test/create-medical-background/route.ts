import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Create medical background
    const medical = await prisma.medicalBackground.create({
      data: {
        patientId: data.patientId,
        medicalHistory: data.medicalHistory,
        medications: data.medications,
        allergies: data.allergies,
        isCurrent: data.isCurrent || true
      }
    });
    
    return NextResponse.json(medical);
  } catch (error) {
    console.error('Error creating test medical background:', error);
    return NextResponse.json({ error: 'Failed to create medical background' }, { status: 500 });
  }
}

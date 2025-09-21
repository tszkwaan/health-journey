import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Create doctor
    const doctor = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: 'DOCTOR',
        passwordHash: 'test-password-hash', // Required field for testing
        voiceAIConsent: false, // Default value
        doctorProfile: {
          create: {
            name: data.name,
            email: data.email,
            specialization: data.specialization || 'Family Medicine',
            bio: 'Test doctor for automated testing',
            phone: data.phone || '555-0123'
          }
        }
      },
      include: {
        doctorProfile: true
      }
    });
    
    return NextResponse.json(doctor);
  } catch (error) {
    console.error('Error creating test doctor:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return NextResponse.json({ 
      error: 'Failed to create doctor', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

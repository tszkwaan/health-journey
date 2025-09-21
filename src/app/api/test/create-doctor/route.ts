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
        phone: data.phone,
        role: 'DOCTOR',
        doctorProfile: {
          create: {
            specialization: data.specialization || 'Family Medicine',
            licenseNumber: `TEST-${Date.now()}`,
            yearsOfExperience: 5
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
    return NextResponse.json({ error: 'Failed to create doctor' }, { status: 500 });
  }
}

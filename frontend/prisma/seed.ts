import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create sample doctors
  const doctors = [
    {
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@clinic.com',
      specialization: 'General Medicine',
      bio: 'Experienced general practitioner with 10+ years of experience in primary care.',
      phone: '+1-555-0101',
      password: 'password123'
    },
    {
      name: 'Dr. Michael Chen',
      email: 'michael.chen@clinic.com',
      specialization: 'Cardiology',
      bio: 'Board-certified cardiologist specializing in heart disease prevention and treatment.',
      phone: '+1-555-0102',
      password: 'password123'
    },
    {
      name: 'Dr. Emily Rodriguez',
      email: 'emily.rodriguez@clinic.com',
      specialization: 'Pediatrics',
      bio: 'Pediatrician with expertise in child development and preventive care.',
      phone: '+1-555-0103',
      password: 'password123'
    }
  ];

  for (const doctorData of doctors) {
    // Check if doctor already exists
    const existingDoctor = await prisma.user.findUnique({
      where: { email: doctorData.email }
    });

    if (!existingDoctor) {
      // Create user account
      const hashedPassword = await bcrypt.hash(doctorData.password, 12);
      
      const user = await prisma.user.create({
        data: {
          name: doctorData.name,
          email: doctorData.email,
          passwordHash: hashedPassword,
          role: Role.DOCTOR
        }
      });

      // Create doctor profile
      await prisma.doctor.create({
        data: {
          name: doctorData.name,
          email: doctorData.email,
          specialization: doctorData.specialization,
          bio: doctorData.bio,
          phone: doctorData.phone,
          userId: user.id,
          startTime: '09:00',
          endTime: '18:00',
          slotDuration: 60
        }
      });

      console.log(`✅ Created doctor: ${doctorData.name}`);
    } else {
      console.log(`⏭️  Doctor already exists: ${doctorData.name}`);
    }
  }

  // Create sample patients
  const patients = [
    {
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    },
    {
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      password: 'password123'
    }
  ];

  for (const patientData of patients) {
    // Check if patient already exists
    const existingPatient = await prisma.user.findUnique({
      where: { email: patientData.email }
    });

    if (!existingPatient) {
      const hashedPassword = await bcrypt.hash(patientData.password, 12);
      
      await prisma.user.create({
        data: {
          name: patientData.name,
          email: patientData.email,
          passwordHash: hashedPassword,
          role: Role.PATIENT
        }
      });

      console.log(`✅ Created patient: ${patientData.name}`);
    } else {
      console.log(`⏭️  Patient already exists: ${patientData.name}`);
    }
  }

  console.log('🎉 Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

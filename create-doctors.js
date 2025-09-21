const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:postgres@localhost:5433/voicecare"
    }
  }
});

async function createDoctors() {
  try {
    console.log('Creating doctors...');
    
    const doctors = [
      {
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@clinic.com',
        specialization: 'General Medicine',
        bio: 'Experienced general practitioner with 10+ years of experience in primary care.',
        phone: '+1-555-0101',
        startTime: '09:00',
        endTime: '18:00',
        slotDuration: 60
      },
      {
        name: 'Dr. Michael Chen',
        email: 'michael.chen@clinic.com',
        specialization: 'Cardiology',
        bio: 'Board-certified cardiologist specializing in heart disease prevention and treatment.',
        phone: '+1-555-0102',
        startTime: '09:00',
        endTime: '18:00',
        slotDuration: 60
      },
      {
        name: 'Dr. Emily Rodriguez',
        email: 'emily.rodriguez@clinic.com',
        specialization: 'Pediatrics',
        bio: 'Pediatrician with expertise in child development and preventive care.',
        phone: '+1-555-0103',
        startTime: '09:00',
        endTime: '18:00',
        slotDuration: 60
      }
    ];
    
    for (const doctorData of doctors) {
      // First, find the user
      const user = await prisma.user.findUnique({
        where: { email: doctorData.email }
      });
      
      if (user) {
        // Check if doctor profile already exists
        const existingDoctor = await prisma.doctor.findUnique({
          where: { userId: user.id }
        });
        
        if (!existingDoctor) {
          const doctor = await prisma.doctor.create({
            data: {
              name: doctorData.name,
              email: doctorData.email,
              specialization: doctorData.specialization,
              bio: doctorData.bio,
              phone: doctorData.phone,
              startTime: doctorData.startTime,
              endTime: doctorData.endTime,
              slotDuration: doctorData.slotDuration,
              userId: user.id
            }
          });
          
          console.log(`✅ Created doctor profile: ${doctorData.name}`);
        } else {
          console.log(`⏭️  Doctor profile already exists: ${doctorData.name}`);
        }
      } else {
        console.log(`❌ User not found: ${doctorData.email}`);
      }
    }
    
    console.log('✅ Doctor profiles created successfully!');
    
  } catch (error) {
    console.error('Error creating doctors:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDoctors();

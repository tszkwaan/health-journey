const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createConsultationTestData() {
  try {
    console.log('🌱 Creating consultation test data...');

    // Find Dr. Emily (assuming she exists)
    const doctorUser = await prisma.user.findFirst({
      where: {
        role: 'DOCTOR',
        name: { contains: 'Emily' }
      }
    });

    if (!doctorUser) {
      console.log('❌ Dr. Emily not found. Please create a doctor user first.');
      return;
    }

    // Find or create Doctor profile
    let doctor = await prisma.doctor.findFirst({
      where: { userId: doctorUser.id }
    });

    if (!doctor) {
      doctor = await prisma.doctor.create({
        data: {
          name: doctorUser.name || 'Dr. Emily',
          email: doctorUser.email,
          specialization: 'General Practice',
          bio: 'Experienced general practitioner',
          phone: '555-0100',
          userId: doctorUser.id
        }
      });
      console.log('✅ Created Dr. Emily profile');
    }

    // Find or create John Doe patient
    let patient = await prisma.user.findFirst({
      where: {
        role: 'PATIENT',
        name: { contains: 'John Doe' }
      }
    });

    if (!patient) {
      patient = await prisma.user.create({
        data: {
          email: 'john.doe@example.com',
          name: 'John Doe',
          role: 'PATIENT',
          phone: '555-0123',
          dateOfBirth: new Date('1985-06-15'),
          gender: 'MALE'
        }
      });
      console.log('✅ Created John Doe patient');
    }

    // Create 4 time slots for today
    const today = new Date();
    const timeSlots = [];
    
    for (let i = 0; i < 4; i++) {
      const hour = 9 + i * 2; // 9 AM, 11 AM, 1 PM, 3 PM
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

      const timeSlot = await prisma.timeSlot.create({
        data: {
          date: today,
          startTime,
          endTime,
          doctorId: doctor.id,
          isAvailable: false
        }
      });
      timeSlots.push(timeSlot);
    }

    // Create 4 reservations with completed intake sessions
    const reservations = [];
    
    for (let i = 0; i < 4; i++) {
      const reservation = await prisma.reservation.create({
        data: {
          status: 'CONFIRMED',
          notes: `Test consultation ${i + 1}`,
          patientId: patient.id,
          doctorId: doctor.id,
          timeSlotId: timeSlots[i].id
        }
      });
      reservations.push(reservation);

      // Create completed intake session
      const intakeSession = await prisma.intakeSession.create({
        data: {
          sessionId: `test-session-${Date.now()}-${i}`,
          progress: 100,
          currentStep: 'complete',
          answers: {
            patient_info: {
              full_name: 'John Doe',
              dob: '1985-06-15',
              phone: '555-0123'
            },
            visit_reason: i === 0 ? 'chest pain' : i === 1 ? 'headache' : i === 2 ? 'fever' : 'back pain',
            symptom_onset: i === 0 ? '2 days ago' : i === 1 ? 'this morning' : i === 2 ? 'yesterday' : '3 days ago',
            previous_treatment: i === 0 ? 'Took ibuprofen' : i === 1 ? 'No treatment' : i === 2 ? 'Rest and fluids' : 'Heat therapy',
            medical_conditions: i === 0 ? 'Hypertension' : i === 1 ? 'None' : i === 2 ? 'Diabetes' : 'Arthritis',
            allergies: i === 0 ? 'Penicillin' : i === 1 ? 'None' : i === 2 ? 'Shellfish' : 'Latex',
            concerns: i === 0 ? 'Worried about heart' : i === 1 ? 'Need sick leave' : i === 2 ? 'High fever' : 'Can\'t work'
          },
          flags: { skipped: {}, editMode: false },
          completeTranscript: [
            {
              timestamp: '09:00:00',
              speaker: 'system',
              content: 'Hello! I\'m here to help you complete your pre-consultation intake.'
            },
            {
              timestamp: '09:00:05',
              speaker: 'patient',
              content: `Hi, I'm John Doe. I'm here for ${i === 0 ? 'chest pain' : i === 1 ? 'headache' : i === 2 ? 'fever' : 'back pain'}.`
            },
            {
              timestamp: '09:00:10',
              speaker: 'system',
              content: 'I understand. Can you tell me when this started?'
            },
            {
              timestamp: '09:00:15',
              speaker: 'patient',
              content: i === 0 ? 'It started 2 days ago' : i === 1 ? 'This morning when I woke up' : i === 2 ? 'Yesterday evening' : 'About 3 days ago'
            },
            {
              timestamp: '09:00:20',
              speaker: 'system',
              content: 'Have you tried any treatment so far?'
            },
            {
              timestamp: '09:00:25',
              speaker: 'patient',
              content: i === 0 ? 'I took some ibuprofen but it didn\'t help much' : i === 1 ? 'No, I haven\'t tried anything yet' : i === 2 ? 'I\'ve been resting and drinking fluids' : 'I\'ve been using heat therapy'
            },
            {
              timestamp: '09:00:30',
              speaker: 'system',
              content: 'Do you have any existing medical conditions?'
            },
            {
              timestamp: '09:00:35',
              speaker: 'patient',
              content: i === 0 ? 'Yes, I have high blood pressure' : i === 1 ? 'No, I\'m generally healthy' : i === 2 ? 'I have diabetes' : 'I have arthritis'
            },
            {
              timestamp: '09:00:40',
              speaker: 'system',
              content: 'Any allergies I should know about?'
            },
            {
              timestamp: '09:00:45',
              speaker: 'patient',
              content: i === 0 ? 'I\'m allergic to penicillin' : i === 1 ? 'No allergies' : i === 2 ? 'I\'m allergic to shellfish' : 'I\'m allergic to latex'
            },
            {
              timestamp: '09:00:50',
              speaker: 'system',
              content: 'Is there anything else you\'d like the doctor to know?'
            },
            {
              timestamp: '09:00:55',
              speaker: 'patient',
              content: i === 0 ? 'I\'m worried this might be something serious with my heart' : i === 1 ? 'I need a sick leave note for work' : i === 2 ? 'My fever is quite high and I\'m concerned' : 'The pain is making it hard to work'
            }
          ]
        }
      });

      // Link the intake session to the reservation
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { intakeSessionId: intakeSession.id }
      });

      // Create medical background
      await prisma.medicalBackground.create({
        data: {
          patientId: patient.id,
          pastMedicalConditions: i === 0 ? ['hypertension'] : i === 1 ? [] : i === 2 ? ['diabetes'] : ['arthritis'],
          otherMedicalCondition: i === 0 ? 'Hypertension, managed with medication' : i === 1 ? null : i === 2 ? 'Type 2 diabetes, well controlled' : 'Osteoarthritis in lower back',
          allergies: i === 0 ? [{ type: 'medication', reaction: 'rash', other: 'Penicillin' }] : i === 1 ? [] : i === 2 ? [{ type: 'food', reaction: 'hives', other: 'Shellfish' }] : [{ type: 'other', reaction: 'skin irritation', other: 'Latex' }],
          otherAllergy: i === 0 ? 'Penicillin' : i === 1 ? null : i === 2 ? 'Shellfish' : 'Latex',
          medications: i === 0 ? [{ name: 'Lisinopril', dosage: '10mg', frequency: 'daily' }] : i === 1 ? [] : i === 2 ? [{ name: 'Metformin', dosage: '500mg', frequency: 'twice daily' }] : [{ name: 'Ibuprofen', dosage: '200mg', frequency: 'as needed' }],
          familyHistory: ['heart_disease', 'diabetes'],
          otherFamilyHistory: 'Father had heart disease, mother has diabetes',
          smoking: { status: 'never', details: null },
          alcohol: { status: 'occasional', details: 'Social drinking only' },
          exerciseFrequency: '2-3 times per week',
          occupation: 'Office worker',
          enhancedSummary: {
            chiefComplaint: i === 0 ? 'Chest pain for 2 days' : i === 1 ? 'Headache since this morning' : i === 2 ? 'Fever since yesterday' : 'Back pain for 3 days',
            historyOfPresentIllness: i === 0 ? 'Patient reports chest pain for 2 days, tried ibuprofen without relief. Concerned about cardiac etiology given family history.' : i === 1 ? 'Patient woke up with headache this morning, no prior treatment attempted.' : i === 2 ? 'Fever developed yesterday evening, patient has been resting and hydrating.' : 'Back pain for 3 days, using heat therapy for relief.',
            pastMedicalHistory: i === 0 ? 'Hypertension on Lisinopril' : i === 1 ? 'No significant PMH' : i === 2 ? 'Type 2 diabetes on Metformin' : 'Osteoarthritis',
            medications: i === 0 ? 'Lisinopril 10mg daily' : i === 1 ? 'None' : i === 2 ? 'Metformin 500mg BID' : 'Ibuprofen PRN',
            allergies: i === 0 ? 'Penicillin' : i === 1 ? 'NKDA' : i === 2 ? 'Shellfish' : 'Latex',
            socialHistory: 'Non-smoker, occasional ETOH, office worker',
            assessment: i === 0 ? 'Chest pain - rule out cardiac etiology' : i === 1 ? 'Headache - likely tension type' : i === 2 ? 'Fever - rule out infection' : 'Back pain - likely musculoskeletal',
            plan: i === 0 ? 'EKG, cardiac enzymes, chest X-ray' : i === 1 ? 'Physical exam, consider imaging if red flags' : i === 2 ? 'Vital signs, CBC, consider chest X-ray' : 'Physical exam, consider imaging'
          }
        }
      });

      console.log(`✅ Created reservation ${i + 1} with intake session`);
    }

    console.log('🎉 Successfully created 4 test reservations with intake data!');
    console.log('📋 Test data summary:');
    console.log(`   - Patient: John Doe (${patient.email})`);
    console.log(`   - Doctor: ${doctor.name} (${doctor.email})`);
    console.log(`   - Reservations: ${reservations.length} created`);
    console.log(`   - Time slots: 9 AM, 11 AM, 1 PM, 3 PM today`);
    console.log(`   - All intake sessions completed with different symptoms`);

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createConsultationTestData();

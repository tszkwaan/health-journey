import { PrismaClient, ReservationStatus } from '@prisma/client';
import { Doctor, TimeSlot, Reservation, CreateReservationRequest, GetAvailableSlotsRequest } from '@/types/reservation';
import { prisma } from './prisma';

// Generate time slots for a doctor on a specific date
export async function generateTimeSlots(doctorId: string, date: Date): Promise<TimeSlot[]> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId }
  });

  if (!doctor) {
    throw new Error('Doctor not found');
  }

  const slots: TimeSlot[] = [];
  const startHour = parseInt(doctor.startTime.split(':')[0]);
  const endHour = parseInt(doctor.endTime.split(':')[0]);
  const slotDuration = doctor.slotDuration;

  for (let hour = startHour; hour < endHour; hour++) {
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    const endHour = hour + (slotDuration / 60);
    const endTime = `${Math.floor(endHour).toString().padStart(2, '0')}:${((endHour % 1) * 60).toString().padStart(2, '0')}`;

    // Check if slot already exists
    const existingSlot = await prisma.timeSlot.findFirst({
      where: {
        doctorId,
        date: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
        },
        startTime,
        endTime
      }
    });

    if (!existingSlot) {
      const slot = await prisma.timeSlot.create({
        data: {
          doctorId,
          date,
          startTime,
          endTime,
          isAvailable: true
        }
      });
      slots.push(slot as TimeSlot);
    } else {
      slots.push(existingSlot as TimeSlot);
    }
  }

  return slots;
}

// Get available time slots for a doctor on a specific date
export async function getAvailableSlots(request: GetAvailableSlotsRequest): Promise<TimeSlot[]> {
  const { doctorId, date } = request;
  const targetDate = new Date(date);

  // First, generate slots for the date if they don't exist
  await generateTimeSlots(doctorId, targetDate);

  // Get all slots for the doctor on the specified date
  const slots = await prisma.timeSlot.findMany({
    where: {
      doctorId,
      date: {
        gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
        lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1)
      },
      isAvailable: true
    },
    include: {
      doctor: true
    },
    orderBy: {
      startTime: 'asc'
    }
  });

  return slots as TimeSlot[];
}

// Create a new reservation
export async function createReservation(
  patientId: string,
  request: CreateReservationRequest
): Promise<Reservation> {
  const { doctorId, timeSlotId, notes } = request;

  // Check if the time slot is available
  const timeSlot = await prisma.timeSlot.findUnique({
    where: { id: timeSlotId },
    include: { reservation: true }
  });

  if (!timeSlot) {
    throw new Error('Time slot not found');
  }

  if (!timeSlot.isAvailable || timeSlot.reservation) {
    throw new Error('Time slot is not available');
  }

  // Check if the time slot belongs to the specified doctor
  if (timeSlot.doctorId !== doctorId) {
    throw new Error('Time slot does not belong to the specified doctor');
  }

  // Create the reservation
  const reservation = await prisma.reservation.create({
    data: {
      patientId,
      doctorId,
      timeSlotId,
      notes,
      status: ReservationStatus.PENDING
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      doctor: true,
      timeSlot: true
    }
  });

  // Mark the time slot as unavailable
  await prisma.timeSlot.update({
    where: { id: timeSlotId },
    data: { isAvailable: false }
  });

  return reservation as Reservation;
}

// Get reservations with filters
export async function getReservations(filters: {
  patientId?: string;
  doctorId?: string;
  status?: ReservationStatus;
  date?: string;
}): Promise<Reservation[]> {
  const where: any = {};

  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.doctorId) where.doctorId = filters.doctorId;
  if (filters.status) where.status = filters.status;

  if (filters.date) {
    const targetDate = new Date(filters.date);
    where.timeSlot = {
      date: {
        gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
        lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1)
      }
    };
  }

  const reservations = await prisma.reservation.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      doctor: true,
      timeSlot: true,
      intakeSession: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return reservations as Reservation[];
}

// Update reservation status
export async function updateReservation(
  reservationId: string,
  updates: {
    status?: ReservationStatus;
    notes?: string;
  }
): Promise<Reservation> {
  const reservation = await prisma.reservation.update({
    where: { id: reservationId },
    data: updates,
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      doctor: true,
      timeSlot: true,
      intakeSession: true
    }
  });

  return reservation as Reservation;
}

// Cancel a reservation
export async function cancelReservation(reservationId: string): Promise<Reservation> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { timeSlot: true }
  });

  if (!reservation) {
    throw new Error('Reservation not found');
  }

  if (reservation.status === ReservationStatus.CANCELLED) {
    throw new Error('Reservation is already cancelled');
  }

  // Update reservation status
  const updatedReservation = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: ReservationStatus.CANCELLED },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      doctor: true,
      timeSlot: true,
      intakeSession: true
    }
  });

  // Make the time slot available again
  await prisma.timeSlot.update({
    where: { id: reservation.timeSlotId },
    data: { isAvailable: true }
  });

  return updatedReservation as Reservation;
}

// Link intake session to reservation
export async function linkIntakeSessionToReservation(
  reservationId: string,
  intakeSessionId: string
): Promise<Reservation> {
  const reservation = await prisma.reservation.update({
    where: { id: reservationId },
    data: { intakeSessionId },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      doctor: true,
      timeSlot: true,
      intakeSession: true
    }
  });

  return reservation as Reservation;
}

// Get all doctors
export async function getDoctors(): Promise<Doctor[]> {
  const doctors = await prisma.doctor.findMany({
    orderBy: {
      name: 'asc'
    }
  });

  return doctors as Doctor[];
}

// Get doctor by ID
export async function getDoctorById(doctorId: string): Promise<Doctor | null> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId }
  });

  return doctor as Doctor | null;
}

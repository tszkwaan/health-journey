import { ReservationStatus } from '@prisma/client';

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization?: string;
  bio?: string;
  phone?: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
}

export interface TimeSlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  doctorId: string;
  doctor?: Doctor;
}

export interface Reservation {
  id: string;
  status: ReservationStatus;
  notes?: string;
  patientId: string;
  doctorId: string;
  timeSlotId: string;
  intakeSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  patient?: {
    id: string;
    name: string;
    email: string;
  };
  doctor?: Doctor;
  timeSlot?: TimeSlot;
  intakeSession?: {
    id: string;
    sessionId: string;
    currentStep: string;
    answers: any;
    progress: number;
  };
}

export interface CreateReservationRequest {
  doctorId: string;
  timeSlotId: string;
  notes?: string;
}

export interface UpdateReservationRequest {
  status?: ReservationStatus;
  notes?: string;
}

export interface GetAvailableSlotsRequest {
  doctorId: string;
  date: string; // YYYY-MM-DD format
}

export interface GetReservationsRequest {
  patientId?: string;
  doctorId?: string;
  status?: ReservationStatus;
  date?: string; // YYYY-MM-DD format
}

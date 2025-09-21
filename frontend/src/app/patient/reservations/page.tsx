"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  email: string;
}

interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface IntakeSession {
  id: string;
  progress: number;
  answers?: any;
}

interface Reservation {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  doctor: Doctor;
  timeSlot: TimeSlot;
  intakeSession?: IntakeSession;
}

export default function PatientReservationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect if not authenticated or not a patient
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'PATIENT') {
      router.push('/');
    }
  }, [status, session, router]);

  // Fetch patient reservations
  useEffect(() => {
    async function fetchReservations() {
      if (status === 'authenticated' && (session?.user as any)?.role === 'PATIENT') {
        try {
          const response = await fetch('/api/patient/reservations');
          if (response.ok) {
            const data = await response.json();
            setReservations(data);
          } else {
            console.error('Failed to fetch reservations:', response.statusText);
          }
        } catch (error) {
          console.error('Error fetching reservations:', error);
        } finally {
          setLoading(false);
        }
      }
    }

    fetchReservations();
  }, [status, session]);

  const getStatusColor = (reservation: Reservation) => {
    if (reservation.status === 'CANCELLED') return 'bg-red-100 text-red-800';
    if (reservation.status === 'COMPLETED') return 'bg-green-100 text-green-800';
    
    // For pending/confirmed reservations, show intake-based status colors
    const intakeStatus = getIntakeStatus(reservation);
    if (intakeStatus === 'Completed') return 'bg-blue-100 text-blue-800';
    if (intakeStatus === 'In Progress') return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  const getStatusText = (reservation: Reservation) => {
    if (reservation.status === 'CANCELLED') return 'Cancelled';
    if (reservation.status === 'COMPLETED') return 'Completed';
    
    // For pending/confirmed reservations, show intake status
    const intakeStatus = getIntakeStatus(reservation);
    if (intakeStatus === 'Completed') return 'Pending for Consultation';
    if (intakeStatus === 'In Progress') return 'Intake In Progress';
    return 'Pending for Intake';
  };

  const getIntakeStatus = (reservation: Reservation) => {
    if (!reservation.intakeSession) return 'Not Started';
    if (reservation.intakeSession.progress === 100) return 'Completed';
    if (reservation.intakeSession.progress > 0) return 'In Progress';
    return 'Not Started';
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
        fontFamily: 'var(--font-noto-sans)'
      }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading your reservations...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || (session?.user as any)?.role !== 'PATIENT') {
    return null;
  }

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
      fontFamily: 'var(--font-noto-sans)'
    }}>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white text-sm font-bold">
              🛡️
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              My Reservations
            </h1>
          </div>
          <p className="text-gray-600">
            View and manage your upcoming appointments and pre-care intake status.
          </p>
        </div>

        {/* Reservations Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* Reservations List */}
          {reservations.length > 0 ? (
            <div className="space-y-4">
              {reservations.map((reservation) => {
                return (
                  <Link 
                    key={reservation.id} 
                    href={`/patient/reservations/${reservation.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-6 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                    <div className="flex items-center gap-6">
                      {/* Doctor Avatar */}
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold text-xl">
                        {reservation.doctor.name.charAt(0)}
                      </div>
                      
                      {/* Reservation Details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">
                            Dr. {reservation.doctor.name}
                          </h3>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(reservation)}`}>
                            {getStatusText(reservation)}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-1">
                          {reservation.doctor.specialization}
                        </p>
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          <span>{formatDate(reservation.timeSlot.date)}</span>
                          <span>{formatTime(reservation.timeSlot.startTime)} - {formatTime(reservation.timeSlot.endTime)}</span>
                        </div>
                      </div>
                    </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reservations found</h3>
              <p className="text-gray-600 mb-6">You haven't made any appointments yet.</p>
              <Link 
                href="/appointments/new"
                className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 font-medium"
              >
                Book an Appointment
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

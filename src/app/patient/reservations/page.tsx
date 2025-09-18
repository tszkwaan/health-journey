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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'Confirmed';
      case 'PENDING':
        return 'Pending';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const getIntakeStatus = (reservation: Reservation) => {
    if (!reservation.intakeSession) return 'Not Started';
    if (reservation.intakeSession.progress === 100) return 'Completed';
    if (reservation.intakeSession.progress > 0) return 'In Progress';
    return 'Not Started';
  };

  const getIntakeStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'text-green-600';
      case 'In Progress':
        return 'text-blue-600';
      case 'Not Started':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
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
      <div className="flex justify-center items-center min-h-screen bg-gray-50" style={{ fontFamily: 'var(--font-noto-sans)' }}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
        <p className="ml-4 text-gray-700">Loading your reservations...</p>
      </div>
    );
  }

  if (status === 'unauthenticated' || (session?.user as any)?.role !== 'PATIENT') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'var(--font-noto-sans)' }}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white text-sm font-bold">
              🛡️
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              HealthPlus
            </h1>
          </div>
          <p className="text-gray-600">
            View and manage your upcoming appointments.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            My Reservations
          </h2>
          <p className="text-gray-600 mb-8">
            View and manage your upcoming appointments and pre-care intake status.
          </p>

          {/* Reservations List */}
          {reservations.length > 0 ? (
            <div className="space-y-4">
              {reservations.map((reservation) => {
                const intakeStatus = getIntakeStatus(reservation);
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
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(reservation.status)}`}>
                            {getStatusText(reservation.status)}
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

                    {/* Intake Status */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm text-gray-500 mb-1">Pre-care Intake</p>
                        <p className={`text-sm font-medium ${getIntakeStatusColor(intakeStatus)}`}>
                          {intakeStatus}
                        </p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${
                        intakeStatus === 'Completed' ? 'bg-green-500' : 
                        intakeStatus === 'In Progress' ? 'bg-blue-500' : 'bg-orange-500'
                      }`}></div>
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

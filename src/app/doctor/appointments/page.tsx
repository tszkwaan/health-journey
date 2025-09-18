"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Patient {
  id: string;
  name: string;
  email: string;
}

interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface Appointment {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  patient: Patient;
  timeSlot: TimeSlot;
  intakeSession?: {
    id: string;
    progress: number;
  };
}

interface AppointmentsByDate {
  today: Appointment[];
  tomorrow: Appointment[];
  nextWeek: Appointment[];
}

export default function DoctorAppointmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentsByDate | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirect if not authenticated or not a doctor
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'DOCTOR') {
      router.push('/');
    }
  }, [status, session, router]);

  // Fetch appointments
  useEffect(() => {
    async function fetchAppointments() {
      if (status === 'authenticated' && (session?.user as any)?.role === 'DOCTOR') {
        try {
          const response = await fetch('/api/doctor/appointments');
          if (response.ok) {
            const data = await response.json();
            setAppointments(data);
          } else {
            console.error('Failed to fetch appointments:', response.statusText);
            // Set empty appointments on error
            setAppointments({
              today: [],
              tomorrow: [],
              nextWeek: []
            });
          }
        } catch (error) {
          console.error('Error fetching appointments:', error);
          // Set empty appointments on error
          setAppointments({
            today: [],
            tomorrow: [],
            nextWeek: []
          });
        } finally {
          setLoading(false);
        }
      }
    }

    fetchAppointments();
  }, [status, session]);

  const getIntakeStatus = (appointment: Appointment) => {
    if (appointment.intakeSession) {
      return appointment.intakeSession.progress >= 100 ? 'completed' : 'pending';
    }
    return 'pending';
  };

  const getIntakeStatusColor = (status: string) => {
    return status === 'completed' ? 'text-green-600' : 'text-orange-500';
  };

  const getIntakeStatusText = (status: string) => {
    return status === 'completed' ? 'Intake Completed' : 'Intake Pending';
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
        day: 'numeric' 
      });
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            Loading appointments...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || (session?.user as any)?.role !== 'DOCTOR') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white text-sm font-bold">
              🛡️
            </Link>
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-noto-sans)' }}>
              HealthPlus
            </h1>
          </div>
          <p className="text-gray-600" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            Manage your upcoming appointments and pre-care intake status.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            Upcoming Appointments
          </h2>
          <p className="text-gray-600 mb-8" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            Manage your upcoming appointments and pre-care intake status.
          </p>

          {/* Today's Appointments */}
          {appointments?.today && appointments.today.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Today
              </h3>
              <div className="space-y-4">
                {appointments.today.map((appointment) => {
                  const intakeStatus = getIntakeStatus(appointment);
                  return (
                    <Link 
                      key={appointment.id} 
                      href={`/doctor/reservations/${appointment.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white font-semibold">
                          {appointment.patient.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                            {appointment.patient.name}
                          </p>
                          <p className="text-gray-600 text-sm" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                            {formatTime(appointment.timeSlot.startTime)} - {formatTime(appointment.timeSlot.endTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${intakeStatus === 'completed' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                        <span className={`text-sm font-medium ${getIntakeStatusColor(intakeStatus)}`} style={{ fontFamily: 'var(--font-noto-sans)' }}>
                          {getIntakeStatusText(intakeStatus)}
                        </span>
                      </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tomorrow's Appointments */}
          {appointments?.tomorrow && appointments.tomorrow.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Tomorrow
              </h3>
              <div className="space-y-4">
                {appointments.tomorrow.map((appointment) => {
                  const intakeStatus = getIntakeStatus(appointment);
                  return (
                    <Link 
                      key={appointment.id} 
                      href={`/doctor/reservations/${appointment.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-blue-400 flex items-center justify-center text-white font-semibold">
                          {appointment.patient.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                            {appointment.patient.name}
                          </p>
                          <p className="text-gray-600 text-sm" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                            {formatTime(appointment.timeSlot.startTime)} - {formatTime(appointment.timeSlot.endTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${intakeStatus === 'completed' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                        <span className={`text-sm font-medium ${getIntakeStatusColor(intakeStatus)}`} style={{ fontFamily: 'var(--font-noto-sans)' }}>
                          {getIntakeStatusText(intakeStatus)}
                        </span>
                      </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Next Week's Appointments */}
          {appointments?.nextWeek && appointments.nextWeek.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Next Week
              </h3>
              <div className="space-y-4">
                {appointments.nextWeek.map((appointment) => {
                  const intakeStatus = getIntakeStatus(appointment);
                  return (
                    <Link 
                      key={appointment.id} 
                      href={`/doctor/reservations/${appointment.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                          {appointment.patient.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                            {appointment.patient.name}
                          </p>
                          <p className="text-gray-600 text-sm" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                            {formatDate(appointment.timeSlot.date)}, {formatTime(appointment.timeSlot.startTime)} - {formatTime(appointment.timeSlot.endTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${intakeStatus === 'completed' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                        <span className={`text-sm font-medium ${getIntakeStatusColor(intakeStatus)}`} style={{ fontFamily: 'var(--font-noto-sans)' }}>
                          {getIntakeStatusText(intakeStatus)}
                        </span>
                      </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* No appointments message */}
          {appointments && appointments.today.length === 0 && appointments.tomorrow.length === 0 && appointments.nextWeek.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                No upcoming appointments
              </h3>
              <p className="text-gray-600" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                You don't have any appointments scheduled for the next week.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

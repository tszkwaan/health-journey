"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  email: string;
  bio: string;
  phone: string;
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

interface ConsultationForm {
  id: string;
  formType: string;
  formData: any;
  isGenerated: boolean;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Reservation {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  doctor: Doctor;
  timeSlot: TimeSlot;
  intakeSession?: IntakeSession;
}

type TabType = 'overview' | 'consultation-summary' | 'intake';

export default function PatientReservationDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const reservationId = params.id as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [consultationForms, setConsultationForms] = useState<ConsultationForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);

  // Redirect if not authenticated or not a patient
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'PATIENT') {
      router.push('/');
    }
  }, [status, session, router]);

  // Fetch reservation details
  useEffect(() => {
    async function fetchReservation() {
      if (status === 'authenticated' && (session?.user as any)?.role === 'PATIENT') {
        try {
          const response = await fetch(`/api/patient/reservations/${reservationId}`);
          if (response.ok) {
            const data = await response.json();
            setReservation(data);
          } else {
            console.error('Failed to fetch reservation:', response.statusText);
          }
        } catch (error) {
          console.error('Error fetching reservation:', error);
        } finally {
          setLoading(false);
        }
      }
    }

    fetchReservation();
  }, [status, session, reservationId]);

  // Fetch consultation forms when consultation summary tab is active
  useEffect(() => {
    if (activeTab === 'consultation-summary' && reservation) {
      fetchConsultationForms();
    }
  }, [activeTab, reservation]);

  const fetchConsultationForms = async () => {
    setFormsLoading(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}/forms`);
      if (response.ok) {
        const data = await response.json();
        setConsultationForms(data || []);
      } else {
        console.error('Failed to fetch consultation forms');
      }
    } catch (error) {
      console.error('Error fetching consultation forms:', error);
    } finally {
      setFormsLoading(false);
    }
  };

  const getReservationStatus = () => {
    if (!reservation) return 'Unknown';
    
    if (reservation.status === 'CANCELLED') return 'Cancelled';
    
    // Check if consultation is completed
    if (reservation.status === 'COMPLETED' || consultationForms.length > 0) {
      return 'Consultation Completed';
    }
    
    // Check if intake is completed
    if (reservation.intakeSession?.progress === 100) {
      return 'Pending for Consultation';
    }
    
    // Default to intake pending
    return 'Pending for Intake';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Consultation Completed':
        return 'bg-green-100 text-green-800';
      case 'Pending for Consultation':
        return 'bg-blue-100 text-blue-800';
      case 'Pending for Intake':
        return 'bg-orange-100 text-orange-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleIntakeClick = () => {
    if (reservation) {
      router.push(`/intake?reservationId=${reservation.id}`);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50" style={{ fontFamily: 'var(--font-noto-sans)' }}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
        <p className="ml-4 text-gray-700">Loading reservation details...</p>
      </div>
    );
  }

  if (status === 'unauthenticated' || (session?.user as any)?.role !== 'PATIENT') {
    return null;
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            Reservation Not Found
          </h1>
          <p className="text-gray-600 mb-4" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            The requested reservation could not be found.
          </p>
          <Link 
            href="/patient/reservations"
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
          >
            Back to My Reservations
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus = getReservationStatus();
  const canStartIntake = !reservation.intakeSession || reservation.intakeSession.progress < 100;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'var(--font-noto-sans)' }}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <nav className="text-sm text-gray-500 mb-2">
                <Link href="/patient/reservations" className="hover:text-gray-700">My Reservations</Link>
                <span className="mx-2">/</span>
                <span>Reservation Details</span>
              </nav>
              <h1 className="text-3xl font-bold text-gray-900">Reservation Details</h1>
              <p className="text-gray-600 mt-1">Dr. {reservation.doctor.name} - {reservation.doctor.specialization}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(currentStatus)}`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${currentStatus === 'Consultation Completed' ? 'bg-green-500' : currentStatus === 'Pending for Consultation' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                {currentStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Reservation Details */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'consultation-summary', label: 'Consultation Summary' },
                    { id: 'intake', label: 'Intake' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabType)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                        activeTab === tab.id
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Appointment Information</h3>
                        <div className="space-y-3">
                          <div>
                            <span className="text-sm font-medium text-gray-500">Date</span>
                            <p className="text-gray-900">{formatDate(reservation.timeSlot.date)}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Time</span>
                            <p className="text-gray-900">{formatTime(reservation.timeSlot.startTime)} - {formatTime(reservation.timeSlot.endTime)}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Status</span>
                            <p className="text-gray-900">{currentStatus}</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Doctor Information</h3>
                        <div className="space-y-3">
                          <div>
                            <span className="text-sm font-medium text-gray-500">Name</span>
                            <p className="text-gray-900">Dr. {reservation.doctor.name}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Specialization</span>
                            <p className="text-gray-900">{reservation.doctor.specialization}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Email</span>
                            <p className="text-gray-900">{reservation.doctor.email}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Phone</span>
                            <p className="text-gray-900">{reservation.doctor.phone}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">About Dr. {reservation.doctor.name}</h3>
                      <p className="text-gray-600">{reservation.doctor.bio}</p>
                    </div>
                  </div>
                )}

                {activeTab === 'consultation-summary' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Consultation Summary</h3>
                    {formsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        <span className="ml-2 text-gray-600">Loading consultation summary...</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {consultationForms.length === 0 ? (
                          <div className="bg-gray-50 rounded-lg p-6 text-center">
                            <p className="text-gray-600">No consultation summary available yet.</p>
                            <p className="text-sm text-gray-500 mt-2">The consultation summary will appear here after your appointment.</p>
                          </div>
                        ) : (
                          consultationForms
                            .filter(form => form.formType === 'patient_summary')
                            .map((form) => (
                              <div key={form.id} className="bg-white border border-gray-200 rounded-lg p-6">
                                <div className="space-y-6">
                                  {form.formData && Object.entries(form.formData).map(([key, value]) => {
                                    if (key === 'citations' || key === 'patientName' || key === 'dateOfBirth' || !value) return null;
                                    
                                    const fieldLabels: { [key: string]: string } = {
                                      diagnosis: 'Your Diagnosis',
                                      medications: 'Your Medications',
                                      instructions: 'Medication Instructions',
                                      homeCare: 'Home Care Instructions',
                                      recovery: 'Recovery Instructions',
                                      followUp: 'Follow-Up Plan',
                                      warningSigns: 'Warning Signs to Watch For',
                                      whenToSeekHelp: 'When to Seek Help'
                                    };
                                    
                                    return (
                                      <div key={key} className="border-b border-gray-100 pb-4 last:border-b-0">
                                        <h4 className="text-md font-semibold text-gray-900 mb-2">
                                          {fieldLabels[key] || key}
                                        </h4>
                                        <div className="text-gray-700 leading-relaxed">
                                          {typeof value === 'string' ? value : JSON.stringify(value)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  
                                  {form.formData?.citations && form.formData.citations.length > 0 && (
                                    <div className="mt-6 pt-4 border-t border-gray-200">
                                      <h4 className="text-md font-semibold text-gray-900 mb-3">References</h4>
                                      <div className="space-y-2">
                                        {form.formData.citations.map((citation: any, index: number) => (
                                          <div key={index} className="text-sm text-gray-600">
                                            <span className="font-medium">[{citation.id}]</span> {citation.content} 
                                            <span className="text-gray-500 ml-2">({citation.source}, {citation.timestamp})</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'intake' && (
                  <div className="space-y-6">
                    {reservation.intakeSession ? (
                      <>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Intake Progress</h3>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Completion</span>
                              <span className="text-sm font-medium text-gray-700">{reservation.intakeSession.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                                style={{ width: `${reservation.intakeSession.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        {reservation.intakeSession.progress === 100 && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Intake Summary</h3>
                            <div className="bg-gray-50 rounded-lg p-4">
                              {reservation.intakeSession.answers ? (
                                <div className="space-y-3">
                                  {Object.entries(reservation.intakeSession.answers).map(([key, value]) => {
                                    // Special handling for patient_info object
                                    if (key === 'patient_info' && typeof value === 'object' && value !== null) {
                                      const patientInfo = value as { full_name?: string; dob?: string; phone?: string };
                                      return (
                                        <div key={key}>
                                          <span className="text-sm font-medium text-gray-700 capitalize">
                                            {key.replace(/_/g, ' ')}:
                                          </span>
                                          <div className="ml-2 mt-1 space-y-1">
                                            <div className="text-sm text-gray-600">
                                              <span className="font-medium">Name:</span> {patientInfo.full_name || 'Not provided'}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                              <span className="font-medium">Date of Birth:</span> {patientInfo.dob || 'Not provided'}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                              <span className="font-medium">Phone:</span> {patientInfo.phone || 'Not provided'}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    
                                    // Handle arrays (like allergies, medical_conditions, etc.)
                                    if (Array.isArray(value)) {
                                      return (
                                        <div key={key}>
                                          <span className="text-sm font-medium text-gray-700 capitalize">
                                            {key.replace(/_/g, ' ')}:
                                          </span>
                                          <span className="text-sm text-gray-600 ml-2">
                                            {value.length > 0 ? value.join(', ') : 'None'}
                                          </span>
                                        </div>
                                      );
                                    }
                                    
                                    // Handle regular string values
                                    return (
                                      <div key={key}>
                                        <span className="text-sm font-medium text-gray-700 capitalize">
                                          {key.replace(/_/g, ' ')}:
                                        </span>
                                        <span className="text-sm text-gray-600 ml-2">
                                          {typeof value === 'string' ? value : JSON.stringify(value)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-600">No intake data available</p>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
                          <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Intake Not Started</h3>
                        <p className="text-gray-600 mb-4">Complete your pre-care intake to help the doctor prepare for your appointment.</p>
                        <button
                          onClick={handleIntakeClick}
                          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 font-medium cursor-pointer"
                        >
                          Start Intake
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Quick Actions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-4">
                {canStartIntake && (
                  <button
                    onClick={handleIntakeClick}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 font-medium cursor-pointer"
                  >
                    Start Intake
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
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

interface IntakeSession {
  id: string;
  progress: number;
  answers?: any;
}

interface Reservation {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  patient: Patient;
  timeSlot: TimeSlot;
  intakeSession?: IntakeSession;
}

type TabType = 'overview' | 'notes' | 'intake';

export default function ReservationDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const reservationId = params.id as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);

  // Redirect if not authenticated or not a doctor
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'DOCTOR') {
      router.push('/');
    }
  }, [status, session, router]);

  // Fetch reservation details
  useEffect(() => {
    async function fetchReservation() {
      if (status === 'authenticated' && (session?.user as any)?.role === 'DOCTOR') {
        try {
          const response = await fetch(`/api/reservations/${reservationId}`);
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

  const getReservationStatus = () => {
    if (!reservation) return 'Unknown';
    
    if (reservation.status === 'CANCELLED') return 'Cancelled';
    if (reservation.status === 'COMPLETED') return 'Completed';
    if (reservation.intakeSession && reservation.intakeSession.progress === 100) return 'Intake Done';
    if (reservation.intakeSession && reservation.intakeSession.progress > 0) return 'In Progress';
    return 'Intake Pending';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Intake Done':
      case 'Completed':
        return 'bg-purple-100 text-purple-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Intake Pending':
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

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMessage = chatMessage;
    setChatMessage('');
    
    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `I understand you're asking about "${userMessage}". Based on the patient's intake information, I can help you with that. This is a placeholder response - in a real implementation, this would connect to a RAG system with the patient's data.`
      }]);
    }, 1000);
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50" style={{ fontFamily: 'var(--font-noto-sans)' }}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
        <p className="ml-4 text-gray-700">Loading reservation details...</p>
      </div>
    );
  }

  if (status === 'unauthenticated' || (session?.user as any)?.role !== 'DOCTOR') {
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
            href="/doctor/appointments"
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
          >
            Back to Appointments
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus = getReservationStatus();

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'var(--font-noto-sans)' }}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <nav className="text-sm text-gray-500 mb-2">
                <Link href="/doctor/appointments" className="hover:text-gray-700">Schedule</Link>
                <span className="mx-2">/</span>
                <span>Reservation Details</span>
              </nav>
              <h1 className="text-3xl font-bold text-gray-900">Reservation Details</h1>
              <p className="text-gray-600 mt-1">Patient: {reservation.patient.name}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(currentStatus)}`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${currentStatus === 'Intake Done' || currentStatus === 'Completed' ? 'bg-purple-500' : currentStatus === 'In Progress' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
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
                    { id: 'notes', label: 'Notes' },
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
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Information</h3>
                        <div className="space-y-3">
                          <div>
                            <span className="text-sm font-medium text-gray-500">Name</span>
                            <p className="text-gray-900">{reservation.patient.name}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Email</span>
                            <p className="text-gray-900">{reservation.patient.email}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-600">
                        {reservation.notes || 'No notes available for this reservation.'}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'intake' && (
                  <div className="space-y-6">
                    {reservation.intakeSession ? (
                      <>
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
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete Transcript</h3>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600">
                              Complete conversation transcript will be available here once the intake system is fully implemented with transcript storage.
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
                          <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Intake Not Started</h3>
                        <p className="text-gray-600">The patient has not yet completed their pre-care intake.</p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Right Column - Q&A Chatbot */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Q&A Chatbot</h3>
              <p className="text-sm text-gray-600 mb-4">Ask questions about the patient from RAG.</p>
              
              {/* Chat History */}
              <div className="h-64 overflow-y-auto mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
                {chatHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm">Start a conversation by asking a question about the patient.</p>
                ) : (
                  <div className="space-y-3">
                    {chatHistory.map((message, index) => (
                      <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                          message.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white text-gray-900 border border-gray-200'
                        }`}>
                          {message.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleChatSubmit} className="space-y-3">
                <textarea
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Type your question here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={3}
                />
                <button
                  type="submit"
                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors duration-200 font-medium"
                >
                  Ask
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

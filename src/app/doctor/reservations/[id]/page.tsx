"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { summarizeIntakeData, IntakeSummary } from '@/lib/intake/summarizer';

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
  completeTranscript?: Array<{
    timestamp: string;
    speaker: 'system' | 'patient';
    content: string;
    step?: string;
  }>;
}

interface Citation {
  id: number;
  type: 'intake' | 'medical_history';
  section: string;
  content: string;
  source: string;
}

interface EnhancedSummary {
  currentSituation: string;
  mainConcerns: string;
  medicalBackground: string;
  aiDiagnosis: string;
  aiSuggestions: string;
  citations: Citation[];
}

interface MedicalBackground {
  id: string;
  llmSummary?: string;
  enhancedSummary?: EnhancedSummary;
  pastMedicalConditions?: string[];
  otherMedicalCondition?: string;
  surgicalHistory?: any[];
  medications?: any[];
  allergies?: any[];
  otherAllergy?: string;
  familyHistory?: string[];
  otherFamilyHistory?: string;
  smoking?: any;
  alcohol?: any;
  exerciseFrequency?: string;
  occupation?: string;
  menstrualCycle?: string;
  menopause?: string;
  pregnancyHistory?: any[];
  contraceptives?: string[];
  immunizations?: any[];
  otherImmunization?: string;
}

interface Reservation {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  patient: Patient;
  timeSlot: TimeSlot;
  intakeSession?: IntakeSession;
  medicalBackground?: MedicalBackground | null;
}

type TabType = 'overview' | 'notes' | 'intake' | 'medical-history';

export default function ReservationDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const reservationId = params.id as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string, sources?: any[], confidence?: number}>>([]);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [includeExternal, setIncludeExternal] = useState(false);
  const [chatContainerRef, setChatContainerRef] = useState<HTMLDivElement | null>(null);
  const [intakeSummary, setIntakeSummary] = useState<IntakeSummary | null>(null);
  const [isGeneratingIntakeSummary, setIsGeneratingIntakeSummary] = useState(false);

  // Set client-side flag to prevent hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef) {
      chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
    }
  }, [chatHistory, chatContainerRef]);

  // Redirect if not authenticated or not a doctor
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'DOCTOR') {
      router.push('/');
    }
  }, [status, session, router]);

  // Generate intake summary
  const generateIntakeSummary = async (answers: any) => {
    if (!answers) return;
    
    setIsGeneratingIntakeSummary(true);
    try {
      const summary = await summarizeIntakeData(answers);
      setIntakeSummary(summary);
    } catch (error) {
      console.error('Error generating intake summary:', error);
    } finally {
      setIsGeneratingIntakeSummary(false);
    }
  };

  // Fetch reservation details
  useEffect(() => {
    async function fetchReservation() {
      if (status === 'authenticated' && (session?.user as any)?.role === 'DOCTOR') {
        try {
          const response = await fetch(`/api/reservations/${reservationId}`);
          if (response.ok) {
            const data = await response.json();
            setReservation(data);
            
            // Generate intake summary if intake session exists
            if (data.intakeSession?.answers) {
              generateIntakeSummary(data.intakeSession.answers);
            }
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
    if (!chatMessage.trim() || isLoadingChat) return;

    const userMessage = chatMessage;
    setChatMessage('');
    setIsLoadingChat(true);
    
    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // Call the RAG API
      const response = await fetch(`/api/reservations/${reservationId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          includeExternal: includeExternal
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      // Add AI response to chat history
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        sources: data.sources,
        confidence: data.confidence
      }]);
    } catch (error) {
      console.error('Error getting chat response:', error);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request. Please try again.'
      }]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const generateEnhancedSummary = async () => {
    if (!reservation) return;
    
    setGeneratingSummary(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}/enhanced-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const { enhancedSummary } = await response.json();
        // Update the reservation with the new enhanced summary
        setReservation(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            medicalBackground: prev.medicalBackground ? {
              ...prev.medicalBackground,
              enhancedSummary: enhancedSummary
            } : null
          };
        });
      } else {
        console.error('Failed to generate enhanced summary');
      }
    } catch (error) {
      console.error('Error generating enhanced summary:', error);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const renderTextWithCitations = (text: string, citations: Citation[]) => {
    if (!text || !citations || citations.length === 0) return text;

    // Convert bullet points to HTML lists
    let htmlText = text
      // First, clean up standalone asterisks and empty lines
      .replace(/^\s*\*\s*$/gm, '') // Remove lines with only asterisks
      .replace(/^\s*$/gm, '') // Remove empty lines
      // Remove ** at the beginning and end of entire sections (multi-line paragraph-level bold)
      .replace(/^\*\*\s*([\s\S]*?)\s*\*\*$/gm, '$1')
      // Remove ** at the beginning of entire sections (when there's no closing **)
      .replace(/^\*\*\s*([\s\S]*)$/gm, '$1')
      // Convert markdown bold (**text**) to HTML bold (for inline bold)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert main bullet points with bold labels (• **Label:** content)
      .replace(/^•\s*\*\*(.*?)\*\*:\s*(.*?)(?=\n•|\n\n|$)/gm, (match, label, content) => {
        if (label.trim() && content.trim()) {
          return `<li><strong>${label}:</strong> ${content}</li>`;
        }
        return match;
      })
      // Convert sub-bullet points (* content) - but only if there's actual content
      .replace(/^\s*\*\s+(.*?)(?=\n\s*\*|\n•|\n\n|$)/gm, (match, content) => {
        if (content.trim() && content.trim() !== '*') {
          return `<li>${content}</li>`;
        }
        return match;
      })
      // Convert simple bullet points (• content) - but not if they're already processed
      .replace(/^•\s+(.*?)(?=\n•|\n\n|$)/gm, (match, content) => {
        if (content.trim() && !content.startsWith('**') && !content.startsWith('<li>')) {
          return `<li>${content}</li>`;
        }
        return match;
      })
      // Wrap consecutive <li> elements in <ul>
      .replace(/(<li>.*?<\/li>)(\s*<li>.*?<\/li>)*/g, '<ul class="list-disc list-inside space-y-1">$&</ul>')
      // Clean up multiple consecutive <ul> tags
      .replace(/<\/ul>\s*<ul class="list-disc list-inside space-y-1">/g, '')
      // Remove empty <li> elements
      .replace(/<li>\s*<\/li>/g, '')
      // Remove any remaining orphaned bullet points
      .replace(/^•\s*$/gm, '')
      .replace(/^\s*\*\s*$/gm, ''); // Remove any remaining standalone asterisks

    // Replace citation numbers with clickable elements (only show numbers, not full text)
    htmlText = htmlText.replace(/\[(\d+)\]/g, (match, citationNumber) => {
      const citation = citations.find(c => c.id === parseInt(citationNumber));
      if (!citation) return match;

      return `<sup class="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-blue-600 bg-blue-100 rounded-full cursor-pointer hover:bg-blue-200 transition-colors" title="${citation.section}: ${citation.content} (Source: ${citation.source})">[${citationNumber}]</sup>`;
    });

    // Remove any remaining full citation text that might have been generated by the LLM
    // This handles cases where the LLM includes full reference text like "[1] Pre-care intake session"
    htmlText = htmlText.replace(/\[\d+\]\s+[^\[\]]+/g, (match) => {
      // Extract just the citation number
      const citationMatch = match.match(/\[(\d+)\]/);
      if (citationMatch) {
        return `[${citationMatch[1]}]`;
      }
      return match;
    });

    return htmlText;
  };

  const renderJsonSection = (sectionData: any, citations: Citation[]) => {
    if (!sectionData || typeof sectionData !== 'object') {
      return '<p>No data available</p>';
    }

    let html = '<ul class="list-disc list-inside space-y-2">';
    
    Object.entries(sectionData).forEach(([key, value]) => {
      if (value && typeof value === 'string' && value.trim() !== 'Not provided' && value.trim() !== 'Unknown') {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const processedValue = renderTextWithCitations(value, citations);
        html += `<li><strong>${formattedKey}:</strong> ${processedValue}</li>`;
      }
    });
    
    html += '</ul>';
    return html;
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
      <div className="w-[80%] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Column - Reservation Details */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'notes', label: 'Notes' },
                    { id: 'intake', label: 'Intake' },
                    { id: 'medical-history', label: 'Medical History' }
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
                    {/* Comprehensive Patient Summary - Moved to Top */}
                    {reservation.medicalBackground && (
                      <>
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-gray-900">Comprehensive Patient Summary</h3>
                          {!reservation.medicalBackground.enhancedSummary && (
                            <button
                              onClick={generateEnhancedSummary}
                              disabled={generatingSummary}
                              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                              {generatingSummary ? 'Generating...' : 'Generate Enhanced Summary'}
                            </button>
                          )}
                        </div>

                        {reservation.medicalBackground.enhancedSummary ? (
                          <div className="space-y-6">
                            {/* Current Situation */}
                            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                                Current Situation
                              </h4>
                              {isClient ? (
                                <div 
                                  className="text-gray-800 leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ul]:ml-4 [&_li]:mb-1"
                                  dangerouslySetInnerHTML={{ 
                                    __html: renderJsonSection(
                                      reservation.medicalBackground.enhancedSummary.currentSituation, 
                                      reservation.medicalBackground.enhancedSummary.citations
                                    ) 
                                  }}
                                />
                              ) : (
                                <div className="text-gray-800 leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ul]:ml-4 [&_li]:mb-1">
                                  {typeof reservation.medicalBackground.enhancedSummary.currentSituation === 'string' 
                                    ? reservation.medicalBackground.enhancedSummary.currentSituation
                                    : 'Loading...'}
                                </div>
                              )}
                            </div>

                            {/* Main Concerns */}
                            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                Current Visit Concerns
                              </h4>
                              {isClient ? (
                                <div 
                                  className="text-gray-800 leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ul]:ml-4 [&_li]:mb-1"
                                  dangerouslySetInnerHTML={{ 
                                    __html: renderJsonSection(
                                      reservation.medicalBackground.enhancedSummary.mainConcerns, 
                                      reservation.medicalBackground.enhancedSummary.citations
                                    ) 
                                  }}
                                />
                              ) : (
                                <div className="text-gray-800 leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ul]:ml-4 [&_li]:mb-1">
                                  {typeof reservation.medicalBackground.enhancedSummary.mainConcerns === 'string' 
                                    ? reservation.medicalBackground.enhancedSummary.mainConcerns
                                    : 'Loading...'}
                                </div>
                              )}
                            </div>

                            {/* Medical Background */}
                            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                Medical Background Summary
                              </h4>
                              {isClient ? (
                                <div 
                                  className="text-gray-800 leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ul]:ml-4 [&_li]:mb-1"
                                  dangerouslySetInnerHTML={{ 
                                    __html: renderJsonSection(
                                      reservation.medicalBackground.enhancedSummary.medicalBackground, 
                                      reservation.medicalBackground.enhancedSummary.citations
                                    ) 
                                  }}
                                />
                              ) : (
                                <div className="text-gray-800 leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ul]:ml-4 [&_li]:mb-1">
                                  {typeof reservation.medicalBackground.enhancedSummary.medicalBackground === 'string' 
                                    ? reservation.medicalBackground.enhancedSummary.medicalBackground
                                    : 'Loading...'}
                                </div>
                              )}
                            </div>

                            {/* AI Diagnosis */}
                            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                </div>
                                AI Diagnosis Analysis (Research-Based)
                              </h4>
                              {isClient ? (
                                <div 
                                  className="text-gray-800 leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ul]:ml-4 [&_li]:mb-1"
                                  dangerouslySetInnerHTML={{ 
                                    __html: renderJsonSection(
                                      reservation.medicalBackground.enhancedSummary.aiDiagnosis, 
                                      reservation.medicalBackground.enhancedSummary.citations
                                    ) 
                                  }}
                                />
                              ) : (
                                <div className="text-gray-800 leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ul]:ml-4 [&_li]:mb-1">
                                  {typeof reservation.medicalBackground.enhancedSummary.aiDiagnosis === 'string' 
                                    ? reservation.medicalBackground.enhancedSummary.aiDiagnosis
                                    : 'Loading...'}
                                </div>
                              )}
                            </div>

                            {/* AI Suggestions */}
                            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                </div>
                                AI Suggestions for Consultation (Evidence-Based)
                              </h4>
                              {isClient ? (
                                <div 
                                  className="text-gray-800 leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ul]:ml-4 [&_li]:mb-1"
                                  dangerouslySetInnerHTML={{ 
                                    __html: renderJsonSection(
                                      reservation.medicalBackground.enhancedSummary.aiSuggestions, 
                                      reservation.medicalBackground.enhancedSummary.citations
                                    ) 
                                  }}
                                />
                              ) : (
                                <div className="text-gray-800 leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ul]:ml-4 [&_li]:mb-1">
                                  {typeof reservation.medicalBackground.enhancedSummary.aiSuggestions === 'string' 
                                    ? reservation.medicalBackground.enhancedSummary.aiSuggestions
                                    : 'Loading...'}
                                </div>
                              )}
                            </div>

                            {/* References Section */}
                            {reservation.medicalBackground.enhancedSummary.citations && reservation.medicalBackground.enhancedSummary.citations.length > 0 && (
                              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                <h4 className="text-lg font-semibold text-gray-900 mb-4">References</h4>
                                <div className="space-y-2">
                                  {reservation.medicalBackground.enhancedSummary.citations.map((citation: any, index: number) => (
                                    <div key={citation.id} className="text-sm text-gray-600 flex items-start">
                                      <span className="font-medium text-gray-900 mr-2">[{citation.id}]</span>
                                      <span>{citation.section}: {citation.content} (Source: {citation.source})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Enhanced Summary Not Generated</h3>
                            <p className="text-gray-600 mb-4">Click the button above to generate a comprehensive AI summary combining intake answers and medical history.</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Appointment and Patient Information */}
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
                            {isGeneratingIntakeSummary ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                <span className="ml-3 text-gray-600">Generating AI summary...</span>
                              </div>
                            ) : intakeSummary ? (
                              <div className="space-y-4">
                                {/* Patient Information */}
                                <div className="border-b border-gray-200 pb-3">
                                  <h4 className="text-md font-semibold text-gray-800 mb-2">Patient Information</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium text-gray-700">Name:</span>
                                      <p className="text-gray-600">{intakeSummary.patient_info.name}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Date of Birth:</span>
                                      <p className="text-gray-600">{intakeSummary.patient_info.dob}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Phone:</span>
                                      <p className="text-gray-600">{intakeSummary.patient_info.phone}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Visit Information */}
                                <div className="space-y-3">
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">Visit Reason:</span>
                                    <p className="text-sm text-gray-600 ml-2">{intakeSummary.visit_reason}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">Symptom Onset:</span>
                                    <p className="text-sm text-gray-600 ml-2">{intakeSummary.symptom_onset}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">Previous Treatment:</span>
                                    <p className="text-sm text-gray-600 ml-2">{intakeSummary.previous_treatment}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">Medical Conditions:</span>
                                    <p className="text-sm text-gray-600 ml-2">{intakeSummary.medical_conditions}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">Allergies:</span>
                                    <p className="text-sm text-gray-600 ml-2">{intakeSummary.allergies}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">Concerns:</span>
                                    <p className="text-sm text-gray-600 ml-2">{intakeSummary.concerns}</p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600">No intake data available</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete Transcript</h3>
                          <div className="bg-gray-50 rounded-lg p-4">
                            {reservation.intakeSession.completeTranscript && reservation.intakeSession.completeTranscript.length > 0 ? (
                              <div className="space-y-3 max-h-96 overflow-y-auto">
                                {reservation.intakeSession.completeTranscript.map((entry, index) => (
                                  <div key={index} className="flex items-start gap-3 text-sm">
                                    <span className="text-gray-500 font-mono min-w-[80px] text-xs">
                                      {entry.timestamp}
                                    </span>
                                    <span className={`font-semibold min-w-[80px] text-xs ${
                                      entry.speaker === 'system' ? 'text-blue-600' : 'text-green-600'
                                    }`}>
                                      {entry.speaker === 'system' ? 'System' : 'Patient'}
                                    </span>
                                    <span className="text-gray-700 flex-1" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                                      {entry.content}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600">
                                No transcript available for this intake session.
                              </p>
                            )}
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

                {activeTab === 'medical-history' && (
                  <div className="space-y-6">
                    {reservation.medicalBackground ? (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Medical History</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="space-y-4">
                            {/* Past Medical Conditions */}
                            {((reservation.medicalBackground.pastMedicalConditions?.length || 0) > 0 || reservation.medicalBackground.otherMedicalCondition) && (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Past Medical Conditions</h4>
                                <div className="text-sm text-gray-600">
                                  {reservation.medicalBackground.pastMedicalConditions?.join(', ')}
                                  {reservation.medicalBackground.otherMedicalCondition && 
                                    ((reservation.medicalBackground.pastMedicalConditions?.length || 0) > 0 ? ', ' : '') + 
                                    reservation.medicalBackground.otherMedicalCondition}
                                </div>
                              </div>
                            )}

                            {/* Medications */}
                            {(reservation.medicalBackground.medications?.length || 0) > 0 && (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Current Medications</h4>
                                <div className="space-y-1">
                                  {reservation.medicalBackground.medications?.map((med: any, index: number) => (
                                    <div key={index} className="text-sm text-gray-600">
                                      {med.name}: {med.dosage} {med.frequency}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Allergies */}
                            {((reservation.medicalBackground.allergies?.length || 0) > 0 || reservation.medicalBackground.otherAllergy) && (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Allergies</h4>
                                <div className="text-sm text-gray-600">
                                  {reservation.medicalBackground.allergies?.map((allergy: any) => `${allergy.type} (${allergy.reaction})`).join(', ')}
                                  {reservation.medicalBackground.otherAllergy && 
                                    ((reservation.medicalBackground.allergies?.length || 0) > 0 ? ', ' : '') + 
                                    reservation.medicalBackground.otherAllergy}
                                </div>
                              </div>
                            )}

                            {/* Family History */}
                            {((reservation.medicalBackground.familyHistory?.length || 0) > 0 || reservation.medicalBackground.otherFamilyHistory) && (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Family History</h4>
                                <div className="text-sm text-gray-600">
                                  {reservation.medicalBackground.familyHistory?.join(', ')}
                                  {reservation.medicalBackground.otherFamilyHistory && 
                                    ((reservation.medicalBackground.familyHistory?.length || 0) > 0 ? ', ' : '') + 
                                    reservation.medicalBackground.otherFamilyHistory}
                                </div>
                              </div>
                            )}

                            {/* Lifestyle */}
                            {(reservation.medicalBackground.smoking?.smokes || reservation.medicalBackground.alcohol?.drinks || reservation.medicalBackground.exerciseFrequency || reservation.medicalBackground.occupation) && (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Lifestyle</h4>
                                <div className="space-y-1 text-sm text-gray-600">
                                  {reservation.medicalBackground.smoking?.smokes && (
                                    <div>Smoking: {reservation.medicalBackground.smoking.packsPerDay || 'Unknown'} packs/day for {reservation.medicalBackground.smoking.yearsSmoked || 'Unknown'} years</div>
                                  )}
                                  {reservation.medicalBackground.alcohol?.drinks && (
                                    <div>Alcohol: {reservation.medicalBackground.alcohol.type || 'Unknown'} {reservation.medicalBackground.alcohol.frequency || 'Unknown frequency'}</div>
                                  )}
                                  {reservation.medicalBackground.exerciseFrequency && (
                                    <div>Exercise: {reservation.medicalBackground.exerciseFrequency}</div>
                                  )}
                                  {reservation.medicalBackground.occupation && (
                                    <div>Occupation: {reservation.medicalBackground.occupation}</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Medical History Available</h3>
                        <p className="text-gray-600">The patient has not yet completed their medical history form.</p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Right Column - Q&A Chatbot */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-8 h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'var(--font-noto-sans)' }}>Q&A Chatbot</h3>
                <div className="flex items-center space-x-2">
                  <label className="flex items-center text-sm text-gray-600" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                    <input
                      type="checkbox"
                      checked={includeExternal}
                      onChange={(e) => setIncludeExternal(e.target.checked)}
                      className="mr-2 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    Include PubMed
                  </label>
                </div>
              </div>
              <p className="text-base text-gray-600 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>Ask questions about the patient. Toggle PubMed to include medical literature search.</p>
              
              {/* Chat History */}
              <div 
                ref={setChatContainerRef}
                className="flex-1 overflow-y-auto mb-6 border-2 border-purple-200 rounded-2xl p-6 bg-gray-50"
              >
                {chatHistory.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500 text-2xl" style={{ fontFamily: 'var(--font-noto-sans)', fontWeight: 200 }}>
                      Start a conversation by asking a question about the patient.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatHistory.map((message, index) => (
                      <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-md px-4 py-3 rounded-2xl text-base ${
                          message.role === 'user' 
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' 
                            : 'bg-white text-gray-900 border-2 border-purple-200'
                        }`} style={{ fontFamily: 'var(--font-noto-sans)', fontWeight: 200 }}>
                          <div className="leading-relaxed">{message.content}</div>
                          {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                            <div className="mt-3 text-sm text-gray-500">
                              <div className="font-medium mb-2">Sources:</div>
                              {message.sources.slice(0, 3).map((source, idx) => (
                                <div key={idx} className="truncate">
                                  • {source.section} ({source.source})
                                </div>
                              ))}
                              {message.sources.length > 3 && (
                                <div className="text-gray-400">+{message.sources.length - 3} more</div>
                              )}
                            </div>
                          )}
                          {message.role === 'assistant' && message.confidence && (
                            <div className="mt-2 text-sm text-gray-400">
                              Confidence: {Math.round(message.confidence * 100)}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* Loading indicator */}
                    {isLoadingChat && (
                      <div className="flex justify-start">
                        <div className="max-w-md px-4 py-3 rounded-2xl text-base bg-white text-gray-900 border-2 border-purple-200">
                          <div className="flex items-center space-x-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                            <span style={{ fontFamily: 'var(--font-noto-sans)', fontWeight: 200 }}>Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleChatSubmit} className="space-y-4">
                <div className="flex gap-4">
                  <textarea
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type your question here..."
                    className="flex-1 rounded-2xl border-2 border-purple-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 p-4 text-lg placeholder-gray-400 transition-all duration-200 resize-none"
                    style={{ fontFamily: 'var(--font-noto-sans)', fontWeight: 200 }}
                    rows={3}
                    disabled={isLoadingChat}
                  />
                  <button
                    type="submit"
                    disabled={!chatMessage.trim() || isLoadingChat}
                    className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed self-end"
                    style={{ fontFamily: 'var(--font-noto-sans)' }}
                  >
                    {isLoadingChat ? 'Thinking...' : 'Ask'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

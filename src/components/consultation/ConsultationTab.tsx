"use client";
import { useState, useRef, useEffect } from 'react';
import { STTWebSocketClient, STTEvent } from '@/lib/voice/wsClient';

interface ConsultationTabProps {
  reservationId: string;
  patientName: string;
}

interface TranscriptEntry {
  timestamp: string;
  speaker: 'speaker';
  content: string;
}

export default function ConsultationTab({ reservationId, patientName }: ConsultationTabProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isCompletingConsultation, setIsCompletingConsultation] = useState(false);
  const [voiceAIConsent, setVoiceAIConsent] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConsultationCompleted, setIsConsultationCompleted] = useState(false);
  const [savedTranscript, setSavedTranscript] = useState<TranscriptEntry[]>([]);
  const [savedNotes, setSavedNotes] = useState('');
  
  const clientRef = useRef<STTWebSocketClient | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);

  // Load saved consultation data
  const loadSavedConsultation = async () => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}/consultation`);
      if (response.ok) {
        const data = await response.json();
        if (data.consultationSession) {
          const session = data.consultationSession;
          if (session.transcript && Array.isArray(session.transcript)) {
            setSavedTranscript(session.transcript);
            // Convert saved transcript to text format
            const text = session.transcript.map((entry: TranscriptEntry) => 
              `[${entry.timestamp}] ${entry.speaker.toUpperCase()}: ${entry.content}`
            ).join('\n');
            setTranscriptText(text);
          }
          
          // Load saved doctor notes
          if (session.doctorNotes) {
            setSavedNotes(session.doctorNotes);
            setDoctorNotes(session.doctorNotes);
          }
          // Check if consultation is completed (has endedAt timestamp)
          if (session.endedAt) {
            setIsConsultationCompleted(true);
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved consultation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user's VoiceAI consent and load saved consultation
  useEffect(() => {
    async function fetchData() {
      try {
        // Load saved consultation data first
        await loadSavedConsultation();
        
        // Then fetch VoiceAI consent
        const res = await fetch('/api/user/settings')
        if (res.ok) {
          const data = await res.json()
          setVoiceAIConsent(data.voiceAIConsent || false)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        setIsLoading(false);
      }
    }
    fetchData()
  }, [reservationId])

  // Helper function to add entries to transcript
  const addToTranscript = (speaker: 'speaker', content: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const entry: TranscriptEntry = { timestamp, speaker, content };
    setTranscript(prev => [...prev, entry]);
  };

  // Start voice recording
  const startRecording = () => {
    if (isRecording || !voiceAIConsent) return;
    
    // Connect to WebSocket for backend streaming
    const url = `ws://localhost:8000/api/voice/ws/stt?sessionId=${reservationId}`;
    const c = new STTWebSocketClient(url);
    c.connect(() => {});
    clientRef.current = c;

    // Set up Web Speech API
    const SpeechRecognitionImpl: typeof window.SpeechRecognition | undefined =
      typeof window !== 'undefined' ? (window.SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined;
    
    if (!SpeechRecognitionImpl) {
      alert('Web Speech API not supported. Use Chrome for this demo.');
      return;
    }
    
    const rec: SpeechRecognition = new SpeechRecognitionImpl();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = '';
      let finalChunk = '';
      
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) finalChunk += res[0].transcript;
        else interim += res[0].transcript;
      }

      if (interim) {
        setLiveTranscript(interim);
        clientRef.current?.sendPartial(interim);
      }
      
      if (finalChunk) {
        addToTranscript('speaker', finalChunk);
        clientRef.current?.sendFinal(finalChunk);
        setLiveTranscript('');
      }
    };
    
    rec.onerror = (e) => {
      console.warn('SpeechRecognition error', e);
      setIsRecording(false);
    };
    
    rec.onend = () => {
      setIsRecording(false);
    };
    
    try {
      rec.start();
      recogRef.current = rec;
      setIsRecording(true);
    } catch (e) {
      console.warn('SpeechRecognition start failed', e);
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    try {
      recogRef.current?.stop();
      clientRef.current?.close();
    } catch (e) {
      console.warn('Error stopping voice input', e);
    }
    setIsRecording(false);
    setLiveTranscript('');
  };

  // Update transcript text when transcript changes
  useEffect(() => {
    const text = transcript.map(entry => 
      `[${entry.timestamp}] ${entry.speaker.toUpperCase()}: ${entry.content}`
    ).join('\n');
    setTranscriptText(text);
  }, [transcript]);

  // Complete consultation and save data
  const completeConsultation = async () => {
    if (!transcriptText.trim()) {
      alert('Please record some consultation content first.');
      return;
    }

    setIsCompletingConsultation(true);
    try {
      // First, save the consultation session to database
      const consultationData = {
        transcript: transcript,
        transcriptText: transcriptText,
        doctorNotes: doctorNotes,
        isRecording: false,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString()
      };

      const saveResponse = await fetch(`/api/reservations/${reservationId}/consultation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consultationData)
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save consultation data');
      }

      // Mark consultation as completed
      setIsConsultationCompleted(true);
      setSavedTranscript(transcript);
      setSavedNotes(doctorNotes);

      // Asynchronously generate all forms in background
      const combinedContent = `CONSULTATION TRANSCRIPT:\n${transcriptText}\n\nDOCTOR NOTES:\n${doctorNotes}`;
      
      // Start form generation in background (don't wait for completion)
      generateAllFormsAsync(combinedContent);

      // Navigate to forms page immediately
      const encodedContent = encodeURIComponent(combinedContent);
      window.open(`/doctor/reservations/${reservationId}/forms?transcript=${encodedContent}`, '_blank');
    } catch (error) {
      console.error('Error completing consultation:', error);
      alert('Error completing consultation. Please try again.');
    } finally {
      setIsCompletingConsultation(false);
    }
  };

  // Asynchronously generate all forms in background
  const generateAllFormsAsync = async (content: string) => {
    try {
      // Get all available form templates
      const formTemplates = [
        'clinician_summary',
        'patient_summary'
      ];

      // Generate forms for each template
      for (const formId of formTemplates) {
        try {
          const response = await fetch('/api/forms/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              formId,
              content,
              reservationId
            })
          });

          if (response.ok) {
            console.log(`Form ${formId} generated successfully`);
          } else {
            console.warn(`Failed to generate form ${formId}`);
          }
        } catch (error) {
          console.warn(`Error generating form ${formId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in background form generation:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Loading consultation data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Consultation Session for {patientName}
              {isConsultationCompleted && (
                <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                  Completed
                </span>
              )}
            </h3>
            <div className="flex items-center gap-4">
              {!isConsultationCompleted ? (
                <button
                  onClick={completeConsultation}
                  disabled={isCompletingConsultation || !transcriptText.trim()}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200 shadow-sm ${
                    isCompletingConsultation || !transcriptText.trim()
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {isCompletingConsultation ? 'Completing...' : 'Complete Consultation'}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Consultation Completed
                </div>
              )}
            </div>
          </div>


      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Transcript Editor */}
        <div className="flex flex-col">
          {/* Start Recording Button */}
          {!isConsultationCompleted && (
            <div className="mb-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!voiceAIConsent}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm ${
                  !voiceAIConsent
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : isRecording
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-pointer'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
              
              {/* Voice consent message - single line */}
              <p className="text-xs text-gray-500 mt-2" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                {voiceAIConsent 
                  ? 'By starting voice recording, you confirm your consent to VoiceAI for consultation recording and summarization.'
                  : 'Voice recording is disabled. Enable VoiceAI in Settings to use voice recording.'
                }
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-gray-700">
              Consultation Transcript {isConsultationCompleted ? '(saved)' : '(editable)'}
            </label>
            <span className="text-xs text-gray-500">
              {isConsultationCompleted ? savedTranscript.length : transcript.length} entries
            </span>
          </div>
          
          <div className="relative">
            <textarea
              value={isConsultationCompleted ? transcriptText : transcriptText}
              onChange={isConsultationCompleted ? undefined : (e) => setTranscriptText(e.target.value)}
              placeholder={isConsultationCompleted ? "Saved consultation transcript" : "Consultation transcript will appear here... You can edit this text directly."}
              readOnly={isConsultationCompleted}
              className={`w-full h-80 p-4 border-2 rounded-lg resize-none bg-white shadow-sm ${
                isConsultationCompleted 
                  ? 'border-gray-200 bg-gray-50 text-gray-700' 
                  : 'border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500'
              }`}
              style={{ 
                fontFamily: 'var(--font-noto-sans)',
                fontSize: '14px',
                lineHeight: '1.6'
              }}
            />
            <div className="absolute top-2 right-2 text-xs text-gray-400 bg-white px-2 py-1 rounded">
              {transcriptText.length} characters
            </div>
          </div>
        </div>

        {/* Right Column - Doctor Notes */}
        <div className="flex flex-col">
          {/* Spacer to align with left column's Start Recording button */}
          {!isConsultationCompleted && (
            <div className="mb-4">
              <div className="h-16"></div> {/* Height to match Start Recording button + consent text + margins */}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-gray-700">
              Doctor Notes {isConsultationCompleted ? '(saved)' : ''}
            </label>
            <span className="text-xs text-gray-500">
              {isConsultationCompleted ? savedNotes.length : doctorNotes.length} characters
            </span>
          </div>
          
          <div className="relative">
            <textarea
              value={isConsultationCompleted ? savedNotes : doctorNotes}
              onChange={isConsultationCompleted ? undefined : (e) => setDoctorNotes(e.target.value)}
              placeholder={isConsultationCompleted ? "Saved doctor notes" : "Add your clinical notes, observations, and additional information here. This will be included when generating forms."}
              readOnly={isConsultationCompleted}
              className={`w-full h-80 p-4 border-2 rounded-lg resize-none bg-white shadow-sm ${
                isConsultationCompleted 
                  ? 'border-gray-200 bg-gray-50 text-gray-700' 
                  : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              }`}
              style={{ 
                fontFamily: 'var(--font-noto-sans)',
                fontSize: '14px',
                lineHeight: '1.6'
              }}
            />
            <div className="absolute top-2 right-2 text-xs text-gray-400 bg-white px-2 py-1 rounded">
              {isConsultationCompleted ? savedNotes.length : doctorNotes.length} characters
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

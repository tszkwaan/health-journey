"use client";
import { useState, useRef, useEffect } from 'react';
import { STTWebSocketClient, STTEvent } from '@/lib/voice/wsClient';

interface ConsultationTabProps {
  reservationId: string;
  patientName: string;
}

interface TranscriptEntry {
  timestamp: string;
  speaker: 'doctor' | 'patient';
  content: string;
}

export default function ConsultationTab({ reservationId, patientName }: ConsultationTabProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [isGeneratingForms, setIsGeneratingForms] = useState(false);
  
  const clientRef = useRef<STTWebSocketClient | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);

  // Helper function to add entries to transcript
  const addToTranscript = (speaker: 'doctor' | 'patient', content: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const entry: TranscriptEntry = { timestamp, speaker, content };
    setTranscript(prev => [...prev, entry]);
  };

  // Start voice recording
  const startRecording = () => {
    if (isRecording) return;
    
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
        addToTranscript('doctor', finalChunk);
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

  // Generate forms
  const generateForms = async () => {
    if (!transcriptText.trim()) {
      alert('Please record some consultation content first.');
      return;
    }

    setIsGeneratingForms(true);
    try {
      // Navigate to form preview page with transcript
      const encodedTranscript = encodeURIComponent(transcriptText);
      window.open(`/doctor/reservations/${reservationId}/forms?transcript=${encodedTranscript}`, '_blank');
    } catch (error) {
      console.error('Error generating forms:', error);
      alert('Error generating forms. Please try again.');
    } finally {
      setIsGeneratingForms(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Consultation Session</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200 shadow-sm ${
              isRecording
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          
          <button
            onClick={generateForms}
            disabled={isGeneratingForms || !transcriptText.trim()}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200 shadow-sm ${
              isGeneratingForms || !transcriptText.trim()
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isGeneratingForms ? 'Generating...' : 'Generate Forms'}
          </button>
        </div>
      </div>

      {/* Recording Status */}
      {isRecording && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-3"></div>
            <span className="text-red-700 font-medium">Recording in progress...</span>
          </div>
        </div>
      )}

      {/* Live Transcript */}
      {liveTranscript && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium mb-1">Live transcript:</div>
          <div className="text-blue-800">{liveTranscript}</div>
        </div>
      )}

      {/* Transcript Editor */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Consultation Transcript (editable)
          </label>
          <span className="text-xs text-gray-500">
            {transcript.length} entries
          </span>
        </div>
        
        <textarea
          value={transcriptText}
          onChange={(e) => setTranscriptText(e.target.value)}
          placeholder="Consultation transcript will appear here... You can edit this text directly."
          className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          style={{ fontFamily: 'var(--font-noto-sans)' }}
        />
        
        <div className="text-xs text-gray-500">
          Format: [timestamp] SPEAKER: content
        </div>
      </div>

      {/* Transcript Entries */}
      {transcript.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Transcript Entries</h4>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {transcript.map((entry, index) => (
              <div key={index} className="flex items-start gap-3 text-xs bg-gray-50 p-2 rounded">
                <span className="text-gray-500 font-mono min-w-[60px]">
                  {entry.timestamp}
                </span>
                <span className={`font-semibold min-w-[60px] ${
                  entry.speaker === 'doctor' ? 'text-blue-600' : 'text-green-600'
                }`}>
                  {entry.speaker.toUpperCase()}
                </span>
                <span className="text-gray-700 flex-1">
                  {entry.content}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

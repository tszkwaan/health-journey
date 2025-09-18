"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { IntakeStep, StartIntakeResponse, MessageIntakeResponse } from "@/lib/intake/types";
import { STTWebSocketClient, STTEvent } from "@/lib/voice/wsClient";

export default function IntakePage() {
  const searchParams = useSearchParams();
  const reservationId = searchParams.get('reservationId');
  
  const [sessionId, setSessionId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<IntakeStep>("patient_info");
  const [progress, setProgress] = useState<number>(0);
  const [utterance, setUtterance] = useState<string>("");
  const [userInput, setUserInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [requiresCorrection, setRequiresCorrection] = useState<boolean>(false);
  const [reviewSnapshot, setReviewSnapshot] = useState<string | null>(null);
  const [currentAnswers, setCurrentAnswers] = useState<any>({});
  
  // Voice input state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [finalTranscripts, setFinalTranscripts] = useState<string[]>([]);
  const [combinedTranscript, setCombinedTranscript] = useState<string>("");
  const clientRef = useRef<STTWebSocketClient | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const lastPartialRef = useRef<string>("");
  const lastFinalRef = useRef<string>("");
  const finalsRef = useRef<string[]>([]);

  // Initialize session on component mount
  useEffect(() => {
    async function startSession() {
      if (sessionId) return;
      
      try {
        setIsLoading(true);
        const response = await fetch('/api/intake/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId })
        });
        
        if (!response.ok) {
          throw new Error('Failed to start session');
        }
        
        const data: StartIntakeResponse = await response.json();
        setSessionId(data.sessionId);
        setCurrentStep(data.current_step);
        setProgress(data.progress);
        setUtterance(data.utterance);
        setCurrentAnswers({});
      } catch (error) {
        console.error('Error starting session:', error);
        setUtterance('Sorry, I encountered an error. Please refresh the page and try again.');
      } finally {
        setIsLoading(false);
      }
    }
    
    startSession();
  }, [sessionId]);

  // Send message to chatbot
  const sendMessage = async () => {
    if (!sessionId || !userInput.trim() || isLoading) return;
    
    try {
      setIsLoading(true);
      setRequiresCorrection(false);
      
      const response = await fetch('/api/intake/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userText: userInput.trim()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const data: MessageIntakeResponse = await response.json();
      setCurrentStep(data.current_step);
      setProgress(data.progress);
      setUtterance(data.utterance);
      setRequiresCorrection(data.requires_correction || false);
      setReviewSnapshot(data.review_snapshot || null);
      setUserInput(''); // Clear input
      
      // Clear voice transcript when sending text input
      setLiveTranscript("");
      setFinalTranscripts([]);
      setCombinedTranscript("");
      lastPartialRef.current = "";
      lastFinalRef.current = "";
      finalsRef.current = [];
      
    } catch (error) {
      console.error('Error sending message:', error);
      setUtterance('Sorry, I encountered an error processing your message. Please try again.');
      setRequiresCorrection(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  // Fetch current session data
  const fetchSessionData = async () => {
    if (!sessionId) return;
    
    try {
      const response = await fetch(`/api/intake/session?sessionId=${sessionId}`);
      if (response.ok) {
        const sessionData = await response.json();
        setCurrentAnswers(sessionData.answers || {});
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
    }
  };

  // Handle special actions
  const handleSpecialAction = async (action: string) => {
    // Fetch current session data first
    await fetchSessionData();
    
    // Set the appropriate original answer based on the action
    switch (action) {
      case 'change name':
        setUserInput(currentAnswers.full_name || '');
        break;
      case 'change date':
        setUserInput(currentAnswers.dob || '');
        break;
      case 'change phone':
        setUserInput(currentAnswers.phone || '');
        break;
      case 'change reason':
        setUserInput(currentAnswers.visit_reason || '');
        break;
      default:
        setUserInput(action);
    }
    
    // Send the change request to the backend
    await sendMessage();
  };

  // Update combined transcript
  const updateCombinedTranscript = (newFinals: string[], newLive: string) => {
    const currentText = [...newFinals, newLive].filter(Boolean).join(' ').trim();
    setCombinedTranscript(currentText);
  };

  // Start voice input
  const startVoiceInput = () => {
    if (!sessionId || isListening) return;
    
    // Connect to WebSocket for backend streaming
    const url = `ws://localhost:8000/api/voice/ws/stt?sessionId=${sessionId}`;
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

      if (interim && interim !== lastPartialRef.current) {
        setLiveTranscript(interim);
        updateCombinedTranscript(finalsRef.current, interim);
        clientRef.current?.sendPartial(interim);
        lastPartialRef.current = interim;
      }
      
      if (finalChunk && finalChunk !== lastFinalRef.current) {
        setFinalTranscripts((prev) => {
          const newFinals = [...prev, finalChunk];
          finalsRef.current = newFinals;
          updateCombinedTranscript(newFinals, "");
          return newFinals;
        });
        clientRef.current?.sendFinal(finalChunk);
        setLiveTranscript("");
        lastFinalRef.current = finalChunk;
      }
    };
    
    rec.onerror = (e) => {
      console.warn('SpeechRecognition error', e);
      setIsListening(false);
    };
    
    rec.onend = () => {
      setIsListening(false);
    };
    
    try {
      rec.start();
      recogRef.current = rec;
      setIsListening(true);
    } catch (e) {
      console.warn('SpeechRecognition start failed', e);
    }
  };

  // Stop voice input
  const stopVoiceInput = () => {
    try {
      recogRef.current?.stop();
      clientRef.current?.close();
    } catch (e) {
      console.warn('Error stopping voice input', e);
    }
    setIsListening(false);
  };

  // Send voice transcript as message
  const sendVoiceTranscript = async () => {
    if (!combinedTranscript.trim()) return;
    
    setUserInput(combinedTranscript);
    
    // Clear voice state
    setLiveTranscript("");
    setFinalTranscripts([]);
    setCombinedTranscript("");
    lastPartialRef.current = "";
    lastFinalRef.current = "";
    finalsRef.current = [];
    
    // Send the message
    await sendMessage();
  };

  // Get step display name
  const getStepDisplayName = (step: IntakeStep): string => {
    const stepNames: Record<IntakeStep, string> = {
      patient_info: "Patient Information",
      visit_reason: "Visit Reason",
      symptom_onset: "Symptom Onset",
      previous_treatment: "Previous Treatment",
      medical_conditions: "Medical Conditions",
      allergies: "Allergies",
      concerns: "Concerns",
      review: "Review",
      complete: "Complete"
    };
    return stepNames[step];
  };

  // Check if we're in review step
  const isReviewStep = currentStep === 'review';
  const isCompleteStep = currentStep === 'complete';

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(180deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)'
    }}>
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-3xl bg-white shadow-2xl border border-purple-100 p-8 md:p-10 h-[500px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between text-sm text-gray-600 mb-3" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            <div className="font-medium">Pre‑Care Intake</div>
            <div className="font-semibold">
              {isCompleteStep ? 'Complete' : `${getStepDisplayName(currentStep)}`}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mb-8 h-2 w-full rounded-full bg-gray-200">
            <div 
              className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500" 
              style={{ width: `${isCompleteStep ? 100 : progress}%` }} 
            />
          </div>

          {/* Bot utterance - hide when complete */}
          {!isCompleteStep && (
            <div className="flex-1 flex flex-col mb-6">
              <div className="bg-gray-50 rounded-2xl p-6 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                    AI
                  </div>
                  <div className="flex-1">
                    <div 
                      className="text-gray-800 text-lg leading-relaxed whitespace-pre-line"
                      style={{ fontFamily: 'var(--font-noto-sans)', fontWeight: 200 }}
                    >
                      {utterance}
                    </div>
                    {reviewSnapshot && (
                      <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                        <div 
                          className="text-sm text-gray-700 whitespace-pre-line"
                          style={{ fontFamily: 'var(--font-noto-sans)' }}
                        >
                          {reviewSnapshot}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* Voice transcript display - hide when complete */}
            {!isCompleteStep && combinedTranscript && (
              <div className="mb-4 p-4 bg-blue-50 rounded-2xl border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-blue-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                    Voice Input
                  </span>
                </div>
                <div 
                  className="text-gray-800 text-lg"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                >
                  {combinedTranscript}
                </div>
              </div>
            )}

            {/* User input form */}
            {!isCompleteStep && (
              <div className="space-y-4">
                <form onSubmit={handleSubmit} className="flex gap-4">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type your response here..."
                    className="flex-1 rounded-2xl border-2 border-purple-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 p-4 text-lg placeholder-gray-400 transition-all duration-200"
                    style={{ fontFamily: 'var(--font-noto-sans)' }}
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={!userInput.trim() || isLoading}
                    className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: 'var(--font-noto-sans)' }}
                  >
                    {isLoading ? 'Sending...' : 'Send'}
                  </button>
                </form>

                {/* Voice input controls */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={isListening ? stopVoiceInput : startVoiceInput}
                    disabled={isLoading}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isListening 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                    style={{ fontFamily: 'var(--font-noto-sans)' }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                    {isListening ? 'Stop Recording' : 'Start Voice Input'}
                  </button>
                  
                  {combinedTranscript && (
                    <button
                      onClick={sendVoiceTranscript}
                      disabled={isLoading || !combinedTranscript.trim()}
                      className="px-6 py-3 rounded-full bg-gradient-to-r from-green-600 to-blue-600 text-white text-sm font-semibold hover:from-green-700 hover:to-blue-700 transition-all duration-200 shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ fontFamily: 'var(--font-noto-sans)' }}
                    >
                      Send Voice Input
                    </button>
                  )}
                </div>
              </div>
            )}


          {/* Completion message */}
          {isCompleteStep && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 
                className="text-2xl font-bold text-gray-900 mb-2"
                style={{ fontFamily: 'var(--font-noto-sans)' }}
              >
                Registration Complete!
              </h3>
              <p 
                className="text-gray-600"
                style={{ fontFamily: 'var(--font-noto-sans)' }}
              >
                Thank you for completing your intake. You're all set!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
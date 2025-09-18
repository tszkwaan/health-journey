"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntakeStore, orderedSteps } from "@/store/intake";
import { prompts } from "@/i18n/prompts";
import { STTWebSocketClient, STTEvent } from "@/lib/voice/wsClient";

export default function IntakePage() {
  const { sessionId, setSession, currentIndex, next, setStep, steps } = useIntakeStore();
  const [lang, setLang] = useState<'en'|'zh-HK'>('en');
  const [live, setLive] = useState<string>("");
  const [finals, setFinals] = useState<string[]>([]);
  const [combined, setCombined] = useState<string>("");
  const clientRef = useRef<STTWebSocketClient | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const finalsRef = useRef<string[]>([]);
  const lastPartialRef = useRef<string>("");
  const lastFinalRef = useRef<string>("");

  const stepKey = orderedSteps[currentIndex];
  const prompt = prompts['en'][stepKey as keyof typeof prompts['en']];
  const progress = Math.round(((currentIndex + 1) / orderedSteps.length) * 100);
  const isGreeting = currentIndex === 0;
  const isLastStep = currentIndex === orderedSteps.length - 1;

  useEffect(() => {
    async function bootstrap() {
      if (sessionId) return;
      const res = await fetch("http://localhost:8000/api/intake/sessions", { method: 'POST' });
      const json = await res.json();
      setSession(json.sessionId);
    }
    bootstrap();
  }, [sessionId, setSession]);

  const connect = () => {
    if (!sessionId) return;
    const url = `ws://localhost:8000/api/voice/ws/stt?sessionId=${sessionId}`;
    const c = new STTWebSocketClient(url);
    // We stream to backend but do not mirror server events into UI to avoid double-appends
    c.connect(() => {});
    clientRef.current = c;

    const SpeechRecognitionImpl: typeof window.SpeechRecognition | undefined =
      typeof window !== 'undefined' ? (window.SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined;
    if (!SpeechRecognitionImpl) {
      alert('Web Speech API not supported. Use Chrome for this demo.');
      return;
    }
    const rec: SpeechRecognition = new SpeechRecognitionImpl();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang === 'en' ? 'en-US' : 'zh-HK';
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const res = ev.results[ev.resultIndex];
      const transcript = res[0].transcript;
      if (!res.isFinal) {
        if (transcript !== lastPartialRef.current) {
          lastPartialRef.current = transcript;
          setLive(transcript);
          setCombined((prev) => (finalsRef.current.join(' ') + ' ' + transcript).trim());
          clientRef.current?.sendPartial(transcript);
        }
      } else {
        if (transcript !== lastFinalRef.current) {
          lastFinalRef.current = transcript;
          setFinals((prev) => {
            const next = [...prev, transcript];
            finalsRef.current = next;
            setCombined(next.join(' ').trim());
            return next;
          });
          clientRef.current?.sendFinal(transcript);
          setLive("");
          lastPartialRef.current = "";
        }
      }
    };
    rec.onerror = (e) => {
      console.warn('SpeechRecognition error', e);
    };
    try { rec.start(); recogRef.current = rec; } catch (e) { console.warn('SpeechRecognition start failed', e); }
  };

  const stop = () => {
    try { recogRef.current?.stop(); } catch {}
    clientRef.current?.close();
  };

  const confirm = async () => {
    const text = (combined || finals.join(' ') || live).trim();
    if (sessionId && text) {
      await fetch(`http://localhost:8000/api/intake/${sessionId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepKey, language: lang, text, confirmed: true }),
      });
      setStep(stepKey, { language: lang, text, confirmed: true });
    }
    setLive(""); setFinals([]); setCombined("");
    if (currentIndex < orderedSteps.length - 1) {
      next();
    }
    // Print summary to console after each action
    await generateSummary();
  };

  const generateSummary = async () => {
    if (!sessionId) return;
    const res = await fetch(`http://localhost:8000/api/intake/${sessionId}/summary`, { method: 'POST' });
    const summary = await res.json();
    console.log('Structured Intake Summary', summary);
  };

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(180deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)'
    }}>
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-3xl bg-white shadow-2xl border border-purple-100 p-8 md:p-10 h-[500px] flex flex-col">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-3" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            <div className="font-medium">Pre‑Care Intake</div>
            <div className="font-semibold">Step {currentIndex + 1} of {orderedSteps.length}</div>
          </div>
          
          {/* Progress bar */}
          <div className="mb-8 h-2 w-full rounded-full bg-gray-200">
            <div 
              className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500" 
              style={{ width: `${progress}%` }} 
            />
          </div>

          {/* Main question */}
          <h2 className="text-3xl md:text-4xl text-gray-900 mb-6 leading-tight flex-shrink-0" style={{ fontFamily: 'var(--font-noto-sans)', fontWeight: 200 }}>{prompt}</h2>

          {!isGreeting && (
            <div className="flex-1 flex flex-col mb-6">
              <textarea
                value={combined}
                onChange={(e)=>setCombined(e.target.value)}
                placeholder="Describe your symptoms or concerns..."
                className="w-full rounded-2xl border-2 border-purple-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 p-6 flex-1 text-lg placeholder-gray-400 resize-none transition-all duration-200"
                style={{ fontFamily: 'var(--font-noto-sans)' }}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between flex-shrink-0 mt-auto">
            {!isGreeting && (
              <div className="flex gap-4">
                <button 
                  onClick={connect} 
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold hover:bg-purple-200 transition-all duration-200 shadow-sm cursor-pointer"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Start Mic
                </button>
                <button 
                  onClick={stop} 
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg cursor-pointer"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Stop
                </button>
              </div>
            )}
            
            <div className="ml-auto">
              <button 
                onClick={async()=>{
                  await confirm();
                  if (isLastStep) {
                    // Finalize: ask backend to generate summary and fetch full intake for doctor reference
                    if (!sessionId) return;
                    try {
                      const [summaryRes, intakeRes] = await Promise.all([
                        fetch(`http://localhost:8000/api/intake/${sessionId}/summary`, { method: 'POST' }),
                        fetch(`http://localhost:8000/api/intake/${sessionId}`),
                      ]);
                      const summary = await summaryRes.json();
                      const intake = await intakeRes.json();
                      console.log('Final Summary', summary);
                      console.log('Complete Intake Record', intake);
                      alert('Submitted. Summary generated for doctor review.');
                    } catch (e) {
                      console.error(e);
                      alert('Submitted, but failed to fetch summary.');
                    }
                  }
                }} 
                className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg cursor-pointer"
                style={{ fontFamily: 'var(--font-noto-sans)' }}
              >
                {isLastStep ? 'Submit' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




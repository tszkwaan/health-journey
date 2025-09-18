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
  const isLast = currentIndex === orderedSteps.length - 1;

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
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-indigo-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl bg-white/80 shadow-lg border p-6 md:p-8">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>Pre‑Care Intake</div>
            <div>Step {currentIndex + 1} of {orderedSteps.length}</div>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-violet-100">
            <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${progress}%` }} />
          </div>

          <h2 className="mt-6 text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">{prompt}</h2>

          {!isGreeting && (
            <div className="mt-4">
              <textarea
                value={combined}
                onChange={(e)=>setCombined(e.target.value)}
                placeholder="Describe your symptoms or concerns..."
                className="w-full rounded-xl border border-violet-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 p-4 min-h-[140px]"
              />
            </div>
          )}

          <div className="mt-6 flex items-center">
            {!isGreeting && (
              <div className="flex gap-3">
                <button onClick={connect} className="px-4 py-2 rounded-full bg-violet-100 text-violet-700 text-sm font-medium hover:bg-violet-200 transition">Start Mic</button>
                <button onClick={stop} className="px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition">Stop</button>
              </div>
            )}
            <div className="ml-auto">
              <button onClick={async()=>{
                await confirm();
                if (isLast) {
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
              }} className="px-5 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">{isLast ? 'Submit' : 'Next'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




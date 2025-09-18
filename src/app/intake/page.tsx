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

  const stepKey = orderedSteps[currentIndex];
  const prompt = prompts[lang][stepKey as keyof typeof prompts['en']];
  const progress = Math.round(((currentIndex + 1) / orderedSteps.length) * 100);

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
    c.connect((e: STTEvent) => {
      if (e.type === 'partial_transcript') {
        setLive(e.text);
        setCombined([...(finals), e.text].join(' ').trim());
      }
      if (e.type === 'final_transcript') {
        setFinals((prev) => {
          const next = [...prev, e.text];
          setCombined(next.join(' ').trim());
          return next;
        });
        setLive("");
      }
    });
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
      let interim = '';
      let finalChunk = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) finalChunk += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (interim) {
        setLive(interim);
        setCombined([...(finals), interim].join(' ').trim());
        clientRef.current?.sendPartial(interim);
      }
      if (finalChunk) {
        setFinals((prev) => {
          const next = [...prev, finalChunk];
          setCombined(next.join(' ').trim());
          return next;
        });
        clientRef.current?.sendFinal(finalChunk);
        setLive("");
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

          <div className="mt-4">
            <textarea
              value={combined}
              onChange={(e)=>setCombined(e.target.value)}
              placeholder="Describe your symptoms or concerns..."
              className="w-full rounded-xl border border-violet-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 p-4 min-h-[140px]"
            />
          </div>

          <div className="mt-6 flex items-center">
            <div className="flex gap-3">
              <button onClick={connect} className="px-4 py-2 rounded-full bg-violet-100 text-violet-700 text-sm font-medium hover:bg-violet-200 transition">Start Mic</button>
              <button onClick={stop} className="px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition">Stop</button>
            </div>
            <div className="ml-auto">
              <button onClick={confirm} className="px-5 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




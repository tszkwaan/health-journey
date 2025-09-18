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
    if (!sessionId || !text) return;
    await fetch(`http://localhost:8000/api/intake/${sessionId}/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: stepKey, language: lang, text, confirmed: true }),
    });
    setStep(stepKey, { language: lang, text, confirmed: true });
    setLive(""); setFinals([]); setCombined("");
    if (currentIndex < orderedSteps.length - 1) {
      next();
    }
    // Print summary to console after each confirmation
    await generateSummary();
  };

  const generateSummary = async () => {
    if (!sessionId) return;
    const res = await fetch(`http://localhost:8000/api/intake/${sessionId}/summary`, { method: 'POST' });
    const summary = await res.json();
    console.log('Structured Intake Summary', summary);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pre‑Care Intake</h1>
      </div>

      <div className="p-4 rounded border bg-gray-50">
        <p className="font-medium mb-2">Step {currentIndex+1} of {orderedSteps.length}</p>
        <p className="text-gray-700">{prompt}</p>
      </div>

      <div className="flex gap-2">
        <button onClick={connect} className="px-4 py-2 rounded bg-emerald-600 text-white">Start Mic</button>
        <button onClick={stop} className="px-4 py-2 rounded border">Stop</button>
        <button onClick={confirm} className="px-4 py-2 rounded bg-indigo-600 text-white">Confirm Step</button>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-gray-600">Transcript (editable)</label>
        <textarea value={combined} onChange={(e)=>setCombined(e.target.value)} className="w-full border rounded p-2" rows={3} />
      </div>
    </div>
  );
}




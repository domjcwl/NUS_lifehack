"use client";

import Link from "next/link";
import { use, useRef, useState } from "react";

type Verdict = {
  verified: boolean;
  item: string;
  stream: string;
  correctlySorted: boolean;
  confidence: number;
  reason: string;
  stubbed?: boolean;
};

type Phase = "capture" | "checking" | "done";

export default function Scan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("capture");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(new Error("Could not read that photo."));
      fr.readAsDataURL(file);
    });

    setPreview(dataUrl);
    setPhase("checking");

    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const v = (await res.json()) as Verdict & { error?: string };
      if (v.error) throw new Error(v.error);

      setVerdict(v);
      if (v.verified) {
        const logged = await fetch("/api/log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            instanceId: id,
            item: v.item,
            confidence: v.confidence,
            reason: v.reason,
          }),
        }).then((r) => r.json());
        setStreak(logged.streak ?? null);
      }
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("capture");
    }
  }

  function retry() {
    setPreview(null);
    setVerdict(null);
    setPhase("capture");
    setError(null);
    fileRef.current?.click();
  }

  return (
    <div className="space-y-5 rise">
      <div>
        <p className="mono text-[10px] text-[var(--ink-soft)]">Scan {id}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">COM3 Level 1 Foyer</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Hold the item at the bin and take one photo. This slot works once.
        </p>
      </div>

      <div className="card overflow-hidden">
        {preview ? (
          <img src={preview} alt="Your photo" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-[var(--ice-1)]">
            <p className="mono text-[10px] text-[var(--ink-soft)]">No photo yet</p>
          </div>
        )}

        <div className="px-5 py-5">
          {phase === "checking" && (
            <p className="mono text-xs text-[var(--sea)]">Checking the photo…</p>
          )}

          {phase === "done" && verdict && (
            <div className="space-y-3">
              <p
                className={`mono text-[10px] ${
                  verdict.verified ? "text-[var(--sea)]" : "text-[var(--coral)]"
                }`}
              >
                {verdict.verified ? "Verified" : "Not counted"}
              </p>
              <p className="text-sm">{verdict.reason}</p>
              {verdict.stubbed && (
                <p className="rounded-lg border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-3 py-2 text-[11px] text-[var(--ink-soft)]">
                  Demo mode: no API key on this machine, so the photo was not actually
                  checked. Set ANTHROPIC_API_KEY to run real validation.
                </p>
              )}
              {verdict.verified && (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-[var(--coral)]">{streak}</span>
                  <span className="mono text-[10px] text-[var(--ink-soft)]">day streak</span>
                </div>
              )}
              {!verdict.correctlySorted && verdict.verified && (
                <p className="rounded-lg bg-[var(--ice-1)] px-3 py-2 text-xs text-[var(--ink-soft)]">
                  Looks like the wrong stream — it belongs in {verdict.stream}.
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Link
                  href="/"
                  className="flex-1 rounded-full bg-[var(--deep)] px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-[var(--sea)]"
                >
                  Back to Nanuq
                </Link>
                {!verdict.verified && (
                  <button
                    onClick={retry}
                    className="rounded-full border border-[var(--edge)] px-4 py-2.5 text-sm"
                  >
                    Retake
                  </button>
                )}
              </div>
            </div>
          )}

          {phase === "capture" && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-full bg-[var(--deep)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--sea)]"
              >
                Take the photo
              </button>
              {error && <p className="mt-3 text-xs text-[var(--coral)]">{error}</p>}
            </>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}

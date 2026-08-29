"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { use, useRef, useState } from "react";

type Verdict = {
  verified: boolean;
  item: string;
  stream: string;
  correctlySorted: boolean;
  confidence: number;
  reason: string;
  stubbed?: boolean;
  mediaHash?: string;
};

type Phase = "capture" | "checking" | "done";

export default function Scan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const reduce = useReducedMotion();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("capture");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [gained, setGained] = useState<number | null>(null);
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
        /* Hand the outgoing floe size to the home screen so the ice is seen
           growing back rather than already grown. */
        try {
          const before = await fetch("/api/log").then((r) => r.json());
          sessionStorage.setItem("floe:fromHealth", String(before.health));
        } catch {
          /* A missing handoff only costs the animation, never the log. */
        }
        const res = await fetch("/api/log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            instanceId: id,
            item: v.item,
            confidence: v.confidence,
            reason: v.reason,
            mediaHash: v.mediaHash,
            correctlySorted: v.correctlySorted,
          }),
        });
        const logged = await res.json();
        if (!res.ok) throw new Error(logged.error ?? "Could not log that.");
        setStreak(logged.streak ?? null);
        setGained(logged.xp ?? null);
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
    <>
      <div className="stagger space-y-4">
        <div>
          <Link href="/" className="press mono inline-block text-label text-[var(--frost-dim)]">
            Back to Nanuq
          </Link>
          {/* One step below the app's page-title size on purpose: this is a
              dynamic bin address that can run long, and this screen is the
              one-handed path at the bin — the camera button has to stay
              above the fold. */}
          <h1 className="mt-2 text-head">Blk 826A Tampines St 81</h1>
          <p className="mt-1 text-body text-[var(--frost-dim)]">
            Hold the item at the blue bin and take one photo. This slot works once.
          </p>
        </div>

        <div className="card overflow-hidden">
          {preview ? (
            <img src={preview} alt="Your photo" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center bg-[var(--night-3)]">
              <p className="mono text-label text-[var(--frost-dim)]">No photo yet</p>
            </div>
          )}

          {(phase === "checking" || phase === "done") && (
            <div className="pad">
              {phase === "checking" && (
                <div className="flex items-center gap-2.5">
                  <span className="size-2 animate-pulse rounded-full bg-[var(--aurora-2)]" />
                  <p className="mono text-label text-[var(--aurora-2)]">Checking the photo…</p>
                </div>
              )}

              {phase === "done" && verdict && (
                <motion.div
                  /* Never from scale(0) — nothing appears from nothing. */
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                  className="space-y-3"
                >
                  <p
                    className={`mono text-label ${
                      verdict.verified ? "text-[var(--aurora-2)]" : "text-[var(--coral)]"
                    }`}
                  >
                    {verdict.verified ? "Verified" : "Not counted"}
                  </p>
                  <p className="text-body">{verdict.reason}</p>

                  {verdict.verified && streak !== null && (
                    <div className="flex items-baseline gap-2">
                      <motion.span
                        initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", bounce: 0.35, duration: 0.5, delay: 0.12 }}
                        className="text-title font-semibold tabular-nums text-[var(--coral)]"
                      >
                        {streak}
                      </motion.span>
                      <span className="mono text-label text-[var(--frost-dim)]">day streak</span>
                    </div>
                  )}

                  {verdict.stubbed && (
                    <p className="rounded-lg border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-3 py-2 text-micro text-[var(--frost-dim)]">
                      Demo mode: no API key on this machine, so the photo was not actually
                      checked. Set ANTHROPIC_API_KEY to run real validation.
                    </p>
                  )}

                  {verdict.verified && !verdict.correctlySorted && (
                    <p className="rounded-lg bg-[var(--night-3)] px-3 py-2 text-micro text-[var(--frost-dim)]">
                      Looks like the wrong stream — it belongs in {verdict.stream}.
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-micro text-[var(--coral)]">{error}</p>}
      </div>

      <div
        className="fixed inset-x-0 z-20 px-4"
        style={{ bottom: "calc(var(--tabbar-h) + var(--safe-b) + 0.75rem)" }}
      >
        <div className="mx-auto flex max-w-lg gap-2.5">
          {phase === "done" && verdict ? (
            <>
              <Link
                href="/"
                className="press flex min-h-14 flex-1 items-center justify-center rounded-full btn-primary px-6 text-body font-medium  "
              >
                Back to Nanuq
              </Link>
              {!verdict.verified && (
                <button
                  onClick={retry}
                  className="press min-h-14 rounded-full border border-[var(--edge)] bg-[var(--night-3)]/60 px-6 text-body"
                >
                  Retake
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={phase === "checking"}
              className="press flex min-h-14 w-full items-center justify-center rounded-full btn-primary px-6 text-body font-medium   disabled:opacity-60"
            >
              {phase === "checking" ? "Checking…" : "Take the photo"}
            </button>
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
    </>
  );
}

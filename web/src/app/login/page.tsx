"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Bear from "@/components/Bear";
import type { BearMood } from "@/lib/types";

type Mode = "create" | "signin";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse opacity-50" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  /* Only ever return to an in-app path, so ?next= cannot be used to bounce
     someone to another origin. */
  const raw = params.get("next") ?? "/group";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/group";

  const [mode, setMode] = useState<Mode>(params.get("mode") === "signin" ? "signin" : "create");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [avail, setAvail] = useState<{ ok: boolean; reason: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bear, setBear] = useState<{ mood: BearMood; health: number; streak: number } | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  const field = useRef<HTMLInputElement>(null);

  /* Show the streak that is at stake, so claiming has a visible reason. */
  useEffect(() => {
    fetch("/api/log")
      .then((r) => r.json())
      .then((d) => {
        setBear({ mood: d.mood, health: d.health, streak: d.streak });
        setIsGuest(d.user?.isGuest ?? true);
      })
      .catch(() => undefined);
    field.current?.focus();
  }, []);

  useEffect(() => {
    if (mode !== "create" || username.length < 2) {
      setAvail(null);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/auth/username?u=${encodeURIComponent(username)}`)
        .then((r) => r.json())
        .then((d) => setAvail({ ok: d.available, reason: d.reason }))
        .catch(() => setAvail(null));
    }, 260);
    return () => clearTimeout(t);
  }, [username, mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === "create" ? "/api/auth/claim" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, pin, displayName: username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That did not work.");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
      setBusy(false);
    }
  }

  const canSubmit =
    username.length >= 3 && pin.length >= 4 && (mode === "signin" || avail?.ok !== false);

  return (
    <div className="space-y-7">
      <section className="rise">
        <div className="card card-lg overflow-hidden">
          <Bear mood={bear?.mood ?? "happy"} health={bear?.health ?? 100} />
        </div>
      </section>

      <header className="rise">
        <h1 className="text-[2.1rem]">
          {mode === "create" ? "Claim your bear" : "Welcome back"}
        </h1>
        <p className="mt-2 max-w-[36ch] text-[1rem] leading-relaxed text-[var(--frost-dim)]">
          {mode === "create" ? (
            isGuest && bear && bear.streak > 0 ? (
              <>
                Your <strong className="text-[var(--frost)]">{bear.streak}-day streak</strong>{" "}
                comes with you. A username lets friends find you, and lets you pick this up on
                any device.
              </>
            ) : (
              "A username lets friends find you, and lets you pick your streak up on any device."
            )
          ) : (
            "Sign in and your floe is exactly where you left it."
          )}
        </p>
      </header>

      <form onSubmit={submit} className="rise space-y-4">
        <div>
          <label htmlFor="username" className="text-[0.9rem] text-[var(--frost-dim)]">
            Username
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[var(--edge)] bg-[var(--night-2)] px-4">
            <span className="text-[var(--frost-faint)]">@</span>
            <input
              id="username"
              ref={field}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              placeholder="your_username"
              /* 16px minimum, or iOS zooms the viewport on focus. */
              className="min-h-14 flex-1 bg-transparent text-base outline-none"
            />
          </div>
          {mode === "create" && avail && (
            <p
              className={`mt-2 text-[0.85rem] ${
                avail.ok ? "text-[var(--aurora-1)]" : "text-[var(--coral)]"
              }`}
            >
              {avail.ok ? "Available" : avail.reason}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="pin" className="text-[0.9rem] text-[var(--frost-dim)]">
            PIN — 4 to 8 digits
          </label>
          <input
            id="pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            type="password"
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            placeholder="••••"
            className="mt-2 min-h-14 w-full rounded-2xl border border-[var(--edge)] bg-[var(--night-2)] px-4 text-base tracking-[0.4em] outline-none"
          />
        </div>

        {error && (
          <p role="alert" className="text-[0.9rem] text-[var(--coral)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="press btn-primary flex min-h-14 w-full items-center justify-center rounded-full text-[0.95rem] disabled:opacity-40"
        >
          {busy ? "One moment…" : mode === "create" ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="rise space-y-3 border-t border-[var(--edge)] pt-6">
        <button
          onClick={() => {
            setMode(mode === "create" ? "signin" : "create");
            setError(null);
            setAvail(null);
          }}
          className="press min-h-11 text-[0.95rem] text-[var(--frost-dim)] underline decoration-[var(--edge-bright)] underline-offset-4"
        >
          {mode === "create" ? "I already have an account" : "Create an account instead"}
        </button>

        <p>
          <Link href="/" className="press min-h-11 text-[0.95rem] text-[var(--frost-faint)]">
            Keep looking around as a guest
          </Link>
        </p>

        <p className="max-w-[40ch] text-[0.8rem] text-[var(--frost-faint)]">
          Prototype sign-in. A PIN is not real security and there is no rate limiting — see the
          README before judging it as one.
        </p>
      </div>
    </div>
  );
}

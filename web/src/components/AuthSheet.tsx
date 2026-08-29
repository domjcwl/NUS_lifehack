"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

type Mode = "create" | "signin";

export interface Me {
  id: string;
  username: string | null;
  displayName: string;
  isGuest: boolean;
}

/**
 * A bottom sheet rather than a page: claiming an account is something you do
 * mid-flow, without losing the screen you were on. It never blocks the app —
 * guests can use everything except friends.
 */
export default function AuthSheet({
  open,
  onClose,
  onDone,
  initialMode = "create",
}: {
  open: boolean;
  onClose: () => void;
  onDone: (me: Me) => void;
  initialMode?: Mode;
}) {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [avail, setAvail] = useState<{ ok: boolean; reason: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setTimeout(() => firstField.current?.focus(), 120);
    }
  }, [open, initialMode]);

  /* Availability is only meaningful when creating. Debounced against typing. */
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
      const path = mode === "create" ? "/api/auth/claim" : "/api/auth/login";
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, pin, displayName: username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That did not work.");
      onDone(data.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const canSubmit =
    username.length >= 3 && pin.length >= 4 && (mode === "signin" || avail?.ok !== false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--night-0)]/70 backdrop-blur-sm"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Create your account" : "Sign in"}
        initial={reduce ? { opacity: 0 } : { y: "100%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.42 }}
        className="card card-lg relative w-full max-w-lg rounded-b-none px-5 pt-5"
        style={{ paddingBottom: "calc(1.25rem + var(--safe-b))" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--edge-bright)]" />

        <h2 className="text-[1.5rem]">
          {mode === "create" ? "Claim your bear" : "Welcome back"}
        </h2>
        <p className="mt-1.5 text-[0.92rem] text-[var(--frost-dim)]">
          {mode === "create"
            ? "Your streak so far comes with you. A username lets friends find you."
            : "Sign in to pick your streak back up on any device."}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <label htmlFor="username" className="mono text-[10px] text-[var(--frost-faint)]">
              Username
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-[var(--edge)] bg-[var(--night-2)] px-4">
              <span className="text-[var(--frost-faint)]">@</span>
              <input
                id="username"
                ref={firstField}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                placeholder="tampines_hari"
                /* 16px minimum, or iOS zooms the viewport on focus. */
                className="min-h-14 flex-1 bg-transparent text-base outline-none"
              />
            </div>
            {mode === "create" && avail && (
              <p
                className={`mt-1.5 text-[0.8rem] ${
                  avail.ok ? "text-[var(--aurora-1)]" : "text-[var(--coral)]"
                }`}
              >
                {avail.ok ? "Available" : avail.reason}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pin" className="mono text-[10px] text-[var(--frost-faint)]">
              PIN — 4 to 8 digits
            </label>
            <input
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              type="password"
              placeholder="••••"
              className="mt-1.5 min-h-14 w-full rounded-2xl border border-[var(--edge)] bg-[var(--night-2)] px-4 text-base tracking-[0.4em] outline-none"
            />
          </div>

          {error && <p className="text-[0.85rem] text-[var(--coral)]">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="press btn-primary flex min-h-14 w-full items-center justify-center rounded-full text-[0.95rem] disabled:opacity-40"
          >
            {busy ? "One moment…" : mode === "create" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "create" ? "signin" : "create");
            setError(null);
          }}
          className="press mt-3 min-h-11 w-full text-[0.88rem] text-[var(--frost-dim)]"
        >
          {mode === "create" ? "I already have an account" : "Create one instead"}
        </button>

        <p className="mt-2 text-center text-[0.75rem] text-[var(--frost-faint)]">
          Prototype sign-in. A PIN is not real security — see the README.
        </p>
      </motion.div>
    </div>
  );
}

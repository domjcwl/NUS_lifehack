"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

/** Labels name their contents rather than hiding behind generic umbrellas. */
const TABS = [
  { href: "/", label: "Nanuq", icon: BearIcon },
  { href: "/bins", label: "Bins", icon: PinIcon },
  { href: "/chat", label: "Ask", icon: ChatIcon },
  { href: "/news", label: "Learn", icon: BookIcon },
  { href: "/impact", label: "Impact", icon: ChartIcon },
];

export default function TabBar() {
  const path = usePathname();

  return (
    <nav
      className="chrome-dark fixed inset-x-0 bottom-0 z-30"
      style={{ paddingBottom: "var(--safe-b)" }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                /* min-h-14 keeps every target well past the 44px floor. */
                /* Vibrancy: over a translucent dark material, muted grey text
                   goes illegible — lift contrast and weight instead. */
                className={clsx(
                  "press relative flex min-h-14 flex-col items-center justify-center gap-1 py-2",
                  active ? "text-white" : "text-white/70",
                )}
              >
                <Icon filled={active} />
                <span
                  className={clsx(
                    "text-[10px] tracking-tight",
                    active ? "font-semibold" : "font-medium",
                  )}
                >
                  {t.label}
                </span>
                {active && (
                  <span className="absolute inset-x-5 top-0 h-px bg-[var(--ice)]" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconProps = { filled?: boolean };
const box = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function BearIcon({ filled }: IconProps) {
  return (
    <svg {...box} aria-hidden>
      <circle cx="12" cy="13" r="5.5" fill={filled ? "currentColor" : "none"} opacity={filled ? 0.18 : 1} />
      <circle cx="12" cy="13" r="5.5" />
      <circle cx="7.5" cy="7.5" r="2.3" />
      <circle cx="16.5" cy="7.5" r="2.3" />
      <circle cx="10.3" cy="12.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="13.7" cy="12.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PinIcon({ filled }: IconProps) {
  return (
    <svg {...box} aria-hidden>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" fill={filled ? "currentColor" : "none"} opacity={filled ? 0.18 : 1} />
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

function ChatIcon({ filled }: IconProps) {
  return (
    <svg {...box} aria-hidden>
      <path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" fill={filled ? "currentColor" : "none"} opacity={filled ? 0.18 : 1} />
      <path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" />
    </svg>
  );
}

function BookIcon({ filled }: IconProps) {
  return (
    <svg {...box} aria-hidden>
      <path d="M4 5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0-2 2Z" fill={filled ? "currentColor" : "none"} opacity={filled ? 0.18 : 1} />
      <path d="M4 5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0-2 2Z" />
      <path d="M17 3h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6" />
    </svg>
  );
}

function ChartIcon({ filled }: IconProps) {
  return (
    <svg {...box} aria-hidden>
      <path d="M5 20V11M12 20V5M19 20v-6" />
      {filled && <path d="M5 20V11M12 20V5M19 20v-6" strokeWidth={3.4} opacity={0.25} />}
    </svg>
  );
}

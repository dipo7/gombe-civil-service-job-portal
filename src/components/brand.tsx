import Link from "next/link";
import { PORTAL_SHORT_NAME } from "@/lib/brand";

// Placeholder mark; swap for the official State crest asset when available.
export function Emblem({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Gombe State Civil Service emblem">
      <circle cx="24" cy="24" r="22" fill="hsl(var(--primary))" stroke="hsl(var(--accent))" strokeWidth="3" />
      <path d="M24 9 L36 14 V25 C36 32 30 37 24 39 C18 37 12 32 12 25 V14 Z" fill="none" stroke="hsl(var(--accent))" strokeWidth="2" />
      <path d="M17 29 L24 17 L31 29 Z" fill="hsl(var(--accent))" />
      <circle cx="24" cy="31" r="2" fill="hsl(var(--primary))" />
    </svg>
  );
}

export function Brand({ href = "/", subtitle }: { href?: string; subtitle?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <Emblem />
      <span className="leading-tight">
        <span className="block text-base font-bold sm:text-lg">{PORTAL_SHORT_NAME}</span>
        <span className="block text-xs uppercase tracking-widest text-accent">{subtitle ?? "Job Portal"}</span>
      </span>
    </Link>
  );
}

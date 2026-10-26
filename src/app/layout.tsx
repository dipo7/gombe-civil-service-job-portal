import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Brand } from "@/components/brand";
import { PORTAL_NAME, PORTAL_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: PORTAL_NAME, template: `%s | ${PORTAL_NAME}` },
  description: "Official recruitment portal of the Gombe State Civil Service. Browse vacancies and apply online.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <header className="border-b-4 border-accent bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Brand />
            <span className="hidden text-sm italic text-accent sm:block">{PORTAL_TAGLINE}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-6 text-xs opacity-90 sm:flex-row sm:justify-between">
            <span>&copy; {new Date().getFullYear()} Gombe State Government. Civil Service Commission.</span>
            <span>Recruitment is free. Do not pay anyone to secure a position.</span>
            <Link href="/privacy" className="underline">
              Privacy Notice
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Cloudflare Turnstile widget. Renders nothing when no site key is configured. */
export function Turnstile({ onToken, resetKey }: { onToken: (token: string) => void; resetKey: number }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(typeof window !== "undefined" && !!window.turnstile);

  useEffect(() => {
    if (!siteKey || !ready || !container.current || !window.turnstile) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    };
    // onToken is stable enough for a one-time render; re-rendering would reset the challenge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, ready]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current) {
      onToken("");
      window.turnstile?.reset(widgetId.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="lazyOnload" onReady={() => setReady(true)} />
      <div ref={container} />
    </>
  );
}

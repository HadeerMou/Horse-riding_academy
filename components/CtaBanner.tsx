"use client";

import Link from "next/link";
import { useReveal } from "@/lib/useReveal";

export default function CtaBanner() {
  const { ref, revealClassName } = useReveal<HTMLElement>();

  return (
    <section ref={ref} className={`cta-banner ${revealClassName}`} aria-labelledby="cta-title" data-header-hide="true">
      <h2 id="cta-title">
        Your first stride
        <br />
        <em>starts here.</em>
      </h2>
      <p>Book a trial session, get placed at your level, and start tracking every ride.</p>
      <Link className="primary-button" href="/register">
        Get started
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h13M13 7l5 5-5 5" />
        </svg>
      </Link>
    </section>
  );
}

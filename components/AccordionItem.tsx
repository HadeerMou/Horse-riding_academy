"use client";

import { useRef, type ReactNode } from "react";

// Opening/closing a <details> changes page height, but the browser doesn't
// move scroll to compensate — so whatever was below (or above) the toggled
// summary visually shifts under a fixed scroll position, reading as "the
// page jumped". This keeps the clicked summary's on-screen position fixed
// by measuring it right before and right after the browser's own toggle.
export default function AccordionItem({
  summary,
  defaultOpen,
  children,
}: {
  summary: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const summaryRef = useRef<HTMLElement>(null);

  function handleClick() {
    const el = summaryRef.current;
    if (!el) return;
    const before = el.getBoundingClientRect().top;
    requestAnimationFrame(() => {
      const after = el.getBoundingClientRect().top;
      if (after !== before) window.scrollBy(0, after - before);
    });
  }

  return (
    <details className="coach-accordion-item" open={defaultOpen}>
      <summary ref={summaryRef} onClick={handleClick}>
        {summary}
      </summary>
      <div className="coach-accordion-body">{children}</div>
    </details>
  );
}

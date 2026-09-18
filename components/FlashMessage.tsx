"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

// Success/error banners are driven by a ?flag=1 redirect param from a server
// action, and that param survives in the URL long after the action did — a
// refresh, a back-navigation, or a bookmarked URL all replay the banner, so
// "Marked out — your coach has been notified" can still be sitting at the top
// of the page days later. Strip the param the moment the banner is on screen
// so it can't come back, and retire the banner itself after a few seconds.
const VISIBLE_MS = 8000;

export default function FlashMessage({
  param,
  tone = "success",
  children,
}: {
  param: string;
  tone?: "success" | "error";
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      // replaceState, not router.replace — this only tidies the address bar;
      // re-running the server render would be pure waste.
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [param]);

  if (!visible) return null;

  return (
    <p className={tone === "error" ? "form-error" : "form-success"} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

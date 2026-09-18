"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";
import { createClient } from "@/lib/supabase/client";

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasRidingLevel, setHasRidingLevel] = useState(false);
  const [surface, setSurface] = useState<"dark" | "light">("dark");
  const [hidden, setHidden] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const { session } = useSession();
  const router = useRouter();

  // The header has no background of its own, so its type has to flip to dark
  // whenever a light section scrolls under it. Sample the page at the header's
  // own midline: whichever section crosses that line is what the text sits on.
  // It also hides itself entirely once the page has scrolled into whichever
  // section is marked as the last one before the footer — nothing left below
  // it needs the nav, and it just crowds the closing CTA.
  useEffect(() => {
    let frame = 0;

    function measure() {
      frame = 0;
      const header = headerRef.current;
      if (!header) return;
      const line = header.getBoundingClientRect().height * 0.55;
      const lightSections = document.querySelectorAll<HTMLElement>('[data-header-surface="light"]');
      let overLight = false;
      lightSections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= line && rect.bottom > line) overLight = true;
      });
      setSurface(overLight ? "light" : "dark");

      const hideSection = document.querySelector<HTMLElement>("[data-header-hide]");
      setHidden(hideSection ? hideSection.getBoundingClientRect().top <= 0 : false);
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setHasRidingLevel(false);
      return;
    }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("riding_level")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setHasRidingLevel(Boolean(data?.riding_level)));
  }, [session]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <header
        className="site-header"
        ref={headerRef}
        data-surface={menuOpen ? "dark" : surface}
        data-hidden={hidden && !menuOpen}
      >
        <Link className="brand" href="/" aria-label="Nocturne Riding Academy home">
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="M13 9v16c0 10 4 15 11 15s11-5 11-15V9M13 17h7M28 17h7" />
          </svg>
          <span>NOCTURNE</span>
          <small>RIDING ACADEMY</small>
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#programs">Programs</a>
          <a href="#method">Our method</a>
          <a href="#story">The academy</a>
        </nav>

        <div className="header-actions">
          {session ? (
            <>
              <Link className="text-button" href="/account">
                My account
              </Link>
              <button className="text-button" type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <Link className="text-button" href="/signin">
              Sign in
            </Link>
          )}
          {!hasRidingLevel && (
            <a className="outline-button" href="#programs">
              Find your level
            </a>
          )}
          <button
            className="menu-button"
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      <div className={`mobile-nav${menuOpen ? " open" : ""}`} id="mobile-nav" aria-hidden={!menuOpen}>
        <nav aria-label="Mobile navigation">
          <a href="#programs" onClick={() => setMenuOpen(false)}>
            Programs
          </a>
          <a href="#method" onClick={() => setMenuOpen(false)}>
            Our method
          </a>
          <a href="#story" onClick={() => setMenuOpen(false)}>
            The academy
          </a>
        </nav>
        <div className="mobile-nav-actions">
          {session ? (
            <>
              <Link className="text-button" href="/account" onClick={() => setMenuOpen(false)}>
                My account
              </Link>
              <button className="text-button" type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <Link className="text-button" href="/signin" onClick={() => setMenuOpen(false)}>
              Sign in
            </Link>
          )}
          {!hasRidingLevel && (
            <a className="outline-button" href="#programs" onClick={() => setMenuOpen(false)}>
              Find your level
            </a>
          )}
        </div>
      </div>
    </>
  );
}

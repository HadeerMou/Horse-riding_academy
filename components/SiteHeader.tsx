"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";
import { createClient } from "@/lib/supabase/client";

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { session } = useSession();
  const router = useRouter();

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
      <header className="site-header">
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
          <a className="outline-button" href="#programs">
            Find your level
          </a>
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
          <a className="outline-button" href="#programs" onClick={() => setMenuOpen(false)}>
            Find your level
          </a>
        </div>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";
import { createClient } from "@/lib/supabase/client";

export default function SiteFooter() {
  const { session } = useSession();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <footer className="site-footer">
      <div className="footer-top">
        <Link className="brand" href="/" aria-label="Nocturne Riding Academy home">
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="M13 9v16c0 10 4 15 11 15s11-5 11-15V9M13 17h7M28 17h7" />
          </svg>
          <span>NOCTURNE</span>
          <small>RIDING ACADEMY</small>
        </Link>
        <p className="footer-tagline">Progressive riding plans for every equestrian level.</p>
      </div>

      <div className="footer-links">
        <div>
          <h4>Academy</h4>
          <a href="#programs">Programs</a>
          <a href="#method">Our method</a>
          <a href="#story">The academy</a>
        </div>
        <div>
          <h4>Account</h4>
          {session ? (
            <>
              <Link className="footer-link-button" href="/account">
                My sessions
              </Link>
              <button className="footer-link-button" type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link className="footer-link-button" href="/signin">
                Sign in
              </Link>
              <Link className="footer-link-button" href="/register">
                Register
              </Link>
            </>
          )}
        </div>
        <div>
          <h4>Visit</h4>
          <p>
            Forest Stables Road
            <br />
            Open by trial &amp; appointment
          </p>
          <p>hello@nocturneridingacademy.com</p>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 Nocturne Riding Academy. All rights reserved.</span>
      </div>
    </footer>
  );
}

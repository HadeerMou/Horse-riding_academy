"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent, useState } from "react";
import AuthHeader from "@/components/AuthHeader";
import GoogleButton from "@/components/GoogleButton";
import Toast from "@/components/Toast";
import { useToast } from "@/lib/useToast";
import { friendlyAuthError } from "@/lib/authErrors";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const { message, showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailForReset, setEmailForReset] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push("/account");
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      showToast(friendlyAuthError(err));
    }
  }

  async function handleForgotPassword() {
    if (!emailForReset) {
      showToast("Enter your email above first, then tap Forgot password.");
      return;
    }
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailForReset, {
        redirectTo: `${window.location.origin}/signin`,
      });
      if (resetError) throw resetError;
      showToast("Password reset email sent — check your inbox.");
    } catch (err) {
      showToast(friendlyAuthError(err));
    }
  }

  return (
    <div className="auth-body">
      <AuthHeader />

      <main className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">
            <span></span> Welcome back
          </p>
          <h1>Sign in.</h1>
          <p className="auth-sub">Pick up where you left off — your plan and sessions are waiting.</p>

          <GoogleButton onClick={handleGoogle} />

          <div className="auth-divider">
            <span>or sign in with email</span>
          </div>

          <form className="auth-form" noValidate onSubmit={handleSubmit}>
            {error && <p className="form-error">{error}</p>}

            <label>
              Email
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                onChange={(event) => setEmailForReset(event.target.value.trim())}
              />
            </label>

            <label>
              Password
              <input type="password" name="password" autoComplete="current-password" required />
            </label>

            <button className="text-button forgot-link" type="button" onClick={handleForgotPassword}>
              Forgot password?
            </button>

            <button className="primary-button auth-submit" type="submit" disabled={loading}>
              <span className="btn-label">{loading ? "Signing in…" : "Sign in"}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h13M13 7l5 5-5 5" />
              </svg>
            </button>
          </form>

          <p className="auth-switch">
            New to the academy? <Link href="/register">Register</Link>
          </p>
        </div>
      </main>

      <Toast message={message} />
    </div>
  );
}

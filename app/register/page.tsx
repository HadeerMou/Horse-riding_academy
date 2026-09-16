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

export default function RegisterPage() {
  const router = useRouter();
  const { message, showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const fullName = String(data.get("fullName") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (signUpError) throw signUpError;

      showToast("Account created — check your email to confirm, then sign in.");
      form.reset();
      setTimeout(() => router.push("/signin"), 1600);
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

  return (
    <div className="auth-body">
      <AuthHeader />

      <main className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">
            <span></span> Join the academy
          </p>
          <h1>Create your account.</h1>
          <p className="auth-sub">
            Register now — your coach will meet you at your trial session and assign the riding
            level that fits.
          </p>

          <GoogleButton onClick={handleGoogle} />

          <div className="auth-divider">
            <span>or register with email</span>
          </div>

          <form className="auth-form" noValidate onSubmit={handleSubmit}>
            {error && <p className="form-error">{error}</p>}

            <label>
              Full name
              <input type="text" name="fullName" autoComplete="name" required />
            </label>

            <label>
              Email
              <input type="email" name="email" autoComplete="email" required />
            </label>

            <label>
              Password
              <input type="password" name="password" autoComplete="new-password" minLength={8} required />
            </label>

            <label>
              Confirm password
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            <button className="primary-button auth-submit" type="submit" disabled={loading}>
              <span className="btn-label">{loading ? "Creating account…" : "Create account"}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h13M13 7l5 5-5 5" />
              </svg>
            </button>
          </form>

          <p className="auth-switch">
            Already riding with us? <Link href="/signin">Sign in</Link>
          </p>
        </div>
      </main>

      <Toast message={message} />
    </div>
  );
}

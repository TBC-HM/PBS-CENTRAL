"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type State = "idle" | "password" | "magic" | "success" | "error";

export function AuthDesk() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setState("password");
    setMessage("");
    try {
      const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.assign("/workspace");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Sign-in failed. Check your details and try again.");
    }
  }

  async function sendMagicLink() {
    setState("magic");
    setMessage("");
    try {
      const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/workspace` }
      });
      if (error) throw error;
      setState("success");
      setMessage("Magic link sent. Open it in this browser to continue.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The magic link could not be sent. Try again.");
    }
  }

  const busy = state === "password" || state === "magic";
  const canSignIn = email.length > 3 && password.length > 0 && !busy;
  const canSendLink = email.length > 3 && !busy;

  return (
    <main className="access-shell">
      <section className="access-thesis" aria-labelledby="access-title">
        <div className="brand-lockup"><span aria-hidden="true">PBS</span><strong>CENTRAL</strong></div>
        <p className="eyebrow">Explicit access</p>
        <h1 id="access-title">Open your<br />evidence desk.</h1>
        <p className="lede">Sign in with an existing PBS Central identity. Authentication alone does not grant workspace access.</p>
        <div className="evidence-line" aria-hidden="true"><span>Briefing</span><i /><span>Outcome</span></div>
      </section>

      <section className="access-panel" aria-label="Sign in">
        <form onSubmit={signIn}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <button className="primary-action" type="submit" disabled={!canSignIn}>{state === "password" ? "Signing in…" : "Sign in"}</button>
          <button className="secondary-action" type="button" disabled={!canSendLink} onClick={sendMagicLink}>{state === "magic" ? "Sending…" : "Send magic link"}</button>
          <div className={`form-message ${state}`} role="status" aria-live="polite">{message}</div>
        </form>
        <p className="access-note"><span>Access rule</span> Authorized PBS Central owners and administrators only. Workspace membership is checked after sign-in.</p>
      </section>
    </main>
  );
}

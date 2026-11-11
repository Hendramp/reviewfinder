"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ nextPath = "/" }: { nextPath?: string }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const client = createClient();
    const result = signup ? await client.auth.signUp({ email, password }) : await client.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) { setMessage({ text: result.error.message, success: false }); return; }
    if (signup && !result.data.session) { setMessage({ text: "Your account is on its way. Check your email to confirm it, then come back and sign in.", success: true }); return; }
    router.push(nextPath); router.refresh();
  }
  return <form onSubmit={submit} className="mt-6 grid gap-4">
    <div className="segment-control" role="group" aria-label="Account action">
      <button type="button" className="segment-option" aria-pressed={!signup} onClick={() => { setSignup(false); setMessage(null); }}>Sign in</button>
      <button type="button" className="segment-option" aria-pressed={signup} onClick={() => { setSignup(true); setMessage(null); }}>Create account</button>
    </div>
    <label className="grid gap-1 text-sm">Email<input className="field" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label className="grid gap-1 text-sm">Password<input className="field" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {message && <p role={message.success ? "status" : "alert"} className={message.success ? "status-success text-sm" : "status-error text-sm"}>{message.text}</p>}
    <button className="button w-full" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />{signup ? "Making your account…" : "Signing you in…"}</> : signup ? "Create your account" : "Sign in"}</button>
  </form>;
}
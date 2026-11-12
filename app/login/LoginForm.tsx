"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isUsernameUniqueViolation, USERNAME_PATTERN, usernameLookupPattern } from "@/lib/username";

type Message = { text: string; success: boolean } | null;
type UsernameAvailability = "idle" | "checking" | "available" | "taken" | "unknown";

export default function LoginForm({ nextPath = "/" }: { nextPath?: string }) {
  const [signup, setSignup] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [usernameBlurred, setUsernameBlurred] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<UsernameAvailability>("idle");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const validUsername = USERNAME_PATTERN.test(username);

  useEffect(() => {
    if (!signup || !usernameBlurred || !validUsername) {
      setUsernameAvailability("idle");
      return;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      setUsernameAvailability("checking");
      try {
        const { data, error } = await createClient().from("profiles")
          .select("id").ilike("username", usernameLookupPattern(username)).maybeSingle();
        if (active) setUsernameAvailability(error ? "unknown" : data ? "taken" : "available");
      } catch {
        if (active) setUsernameAvailability("unknown");
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [signup, username, usernameBlurred, validUsername]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (signup && !validUsername) return;
    setBusy(true);
    setMessage(null);
    const client = createClient();

    if (signup) {
      const { data, error } = await client.auth.signUp({
        email: identifier.trim(),
        password,
        options: { data: { username, full_name: username } },
      });
      if (error) {
        let usernameTaken = isUsernameUniqueViolation(error);
        if (!usernameTaken) {
          const { data: existingUsername, error: lookupError } = await client.from("profiles")
            .select("id").ilike("username", usernameLookupPattern(username)).maybeSingle();
          usernameTaken = !lookupError && Boolean(existingUsername);
        }
        setBusy(false);
        if (usernameTaken) setUsernameAvailability("taken");
        setMessage({
          text: usernameTaken
            ? "That username was just taken — try another."
            : "Could not create your account. Please try again.",
          success: false,
        });
        return;
      }
      setBusy(false);
      if (!data.session) {
        setMessage({ text: "Your account is on its way. Check your email to confirm it, then come back and sign in.", success: true });
        return;
      }
      router.push(nextPath);
      router.refresh();
      return;
    }

    const login = identifier.trim();
    let email = login;
    if (!login.includes("@")) {
      const { data, error } = await client.rpc("email_for_login", { login });
      if (error) {
        setBusy(false);
        setMessage({ text: "Unable to sign in. Please try again.", success: false });
        return;
      }
      if (!data) {
        setBusy(false);
        setMessage({ text: "No account found with that username", success: false });
        return;
      }
      email = data;
    }

    const { error } = await client.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMessage({ text: "Invalid email or username, or password.", success: false });
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return <form onSubmit={submit} className="mt-6 grid gap-4">
    <div className="segment-control" role="group" aria-label="Account action">
      <button type="button" className="segment-option" aria-pressed={!signup} onClick={() => { setSignup(false); setMessage(null); }}>Sign in</button>
      <button type="button" className="segment-option" aria-pressed={signup} onClick={() => { setSignup(true); setMessage(null); }}>Create account</button>
    </div>
    <label className="grid gap-1 text-sm">{signup ? "Email" : "Email or username"}<input className="field" type={signup ? "email" : "text"} autoComplete={signup ? "email" : "username"} required value={identifier} onChange={(event) => setIdentifier(event.target.value)} /></label>
    {signup && <label className="grid gap-1 text-sm">Username<input className="field" type="text" autoComplete="username" required maxLength={24} value={username} onBlur={() => setUsernameBlurred(true)} onChange={(event) => { setUsername(event.target.value); setUsernameBlurred(false); }} aria-describedby="username-help username-availability" /><span id="username-help" className="text-xs text-[var(--muted)]">3–24 characters: lowercase letters, numbers, and underscores only.</span><span id="username-availability" aria-live="polite" className={`text-xs ${usernameAvailability === "taken" ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>{usernameAvailability === "checking" ? "Checking availability…" : usernameAvailability === "available" ? "Username is available." : usernameAvailability === "taken" ? "That username is taken." : usernameAvailability === "unknown" ? "Could not check availability right now." : ""}</span></label>}
    <label className="grid gap-1 text-sm">Password<input className="field" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {message && <p role={message.success ? "status" : "alert"} className={message.success ? "status-success text-sm" : "status-error text-sm"}>{message.text}</p>}
    <button className="button w-full" disabled={busy || (signup && (!validUsername || usernameAvailability === "taken"))}>{busy ? <><span className="spinner" aria-hidden="true" />{signup ? "Making your account…" : "Signing you in…"}</> : signup ? "Create your account" : "Sign in"}</button>
  </form>;
}

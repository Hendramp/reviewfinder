"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfileUsername } from "@/lib/actions";
import { USERNAME_PATTERN } from "@/lib/username";

export default function UsernameForm() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const validUsername = USERNAME_PATTERN.test(username);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validUsername) return;
    setBusy(true);
    setMessage(null);
    const result = await saveProfileUsername(username);
    setBusy(false);
    if (result.error) {
      setMessage({ text: result.error, success: false });
      return;
    }
    setMessage({ text: "Username saved.", success: true });
    router.refresh();
  }

  return <form onSubmit={submit} className="mt-4 grid max-w-md gap-3">
    <label className="grid gap-1 text-sm font-medium">Choose a username<input className="field" type="text" autoComplete="username" required maxLength={24} value={username} onChange={(event) => setUsername(event.target.value)} aria-describedby="profile-username-help" /></label>
    <p id="profile-username-help" className="text-xs text-[var(--muted)]">3–24 characters: lowercase letters, numbers, and underscores only.</p>
    {message && <p role={message.success ? "status" : "alert"} className={message.success ? "status-success text-sm" : "status-error text-sm"}>{message.text}</p>}
    <button className="button justify-self-start" disabled={busy || !validUsername}>{busy ? "Saving…" : "Save username"}</button>
  </form>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <span className="inline-flex items-center gap-2"><button className="rounded border border-[var(--line)] px-2.5 py-1.5 text-[var(--muted)] transition-colors hover:border-[var(--coral)] hover:text-[var(--coral)] active:scale-95 disabled:opacity-60" disabled={busy} onClick={async () => { setBusy(true); setMessage(""); const { error } = await createClient().auth.signOut(); if (error) { setMessage("Could not sign out"); setBusy(false); return; } router.push("/"); router.refresh(); }}>{busy ? "Signing out…" : "Sign out"}</button>{message && <span role="alert" className="text-xs text-[var(--coral)]">{message}</span>}</span>;
}
"use client";

import Link from "next/link";
import { useState } from "react";
import { submitReviewReport } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import type { ReportReason } from "@/lib/types";

const reasons: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "not_a_real_review", label: "Not a real review" },
  { value: "wrong_place", label: "Wrong place" },
  { value: "other", label: "Other" },
];

export default function ReportButton({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [signInPrompt, setSignInPrompt] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function openForm() {
    setMessage("");
    setSignInPrompt(false);
    const { data: { user }, error } = await createClient().auth.getUser();
    if (error) {
      setMessage("Could not verify your sign-in. Please try again.");
      return;
    }
    if (!user) {
      setSignInPrompt(true);
      return;
    }
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result = await submitReviewReport({ reviewId, reason, note });
    setBusy(false);
    if (result.error) {
      setMessage(result.error);
      if (result.error === "Sign in to report this review.") setSignInPrompt(true);
      return;
    }
    setOpen(false);
    setMessage("Report submitted.");
  }

  return <>
    <button type="button" className="min-h-11 text-xs text-[var(--muted)] underline underline-offset-2" onClick={() => void openForm()}>Report</button>
    {signInPrompt && <span className="ml-2 text-xs text-[var(--muted)]">Please <Link className="underline" href="/login">sign in</Link> to report this review.</span>}
    {open && <div role="dialog" aria-modal="true" aria-labelledby={`report-title-${reviewId}`} className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><form onSubmit={submit} className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"><div className="mb-4 flex justify-between"><h2 id={`report-title-${reviewId}`} className="serif text-xl">Report this review</h2><button type="button" className="min-h-11 min-w-11" aria-label="Close" onClick={() => setOpen(false)}>×</button></div><label className="grid gap-1 text-sm">Reason<select className="field" value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>{reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="mt-4 grid gap-1 text-sm">Note (optional)<textarea className="field min-h-20" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} /></label>{message && <p role="alert" className="mt-3 text-sm text-[var(--accent)]">{message}</p>}<div className="mt-4 flex justify-end"><button className="button" disabled={busy}>{busy ? "Sending…" : "Submit report"}</button></div></form></div>}
    {message && !open && <span role="status" className="ml-2 text-xs text-[var(--muted)]">{message}</span>}
  </>;
}

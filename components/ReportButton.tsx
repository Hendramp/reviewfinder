"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ReportReason } from "@/lib/types";

const reasons: { value: ReportReason; label: string }[] = [
  { value: "harassment", label: "Harassment" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "doxxing", label: "Doxxing" },
  { value: "spam", label: "Spam" },
  { value: "illegal_content", label: "Illegal content" },
  { value: "accuses_named_person_of_crime", label: "Accuses a named person of a crime" },
];

export default function ReportButton({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const client = createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) { setMessage("Sign in to report this review."); setBusy(false); return; }
    const { error } = await client.from("reports").insert({ review_id: reviewId, reporter_id: user.id, reason, note: note || null });
    setMessage(error ? error.message : "Report submitted."); setBusy(false);
    if (!error) setOpen(false);
  }
  return <>
    <button type="button" className="text-xs text-[var(--muted)] underline underline-offset-2" onClick={() => setOpen(true)}>Report</button>
    {open && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><form onSubmit={submit} className="w-full max-w-md rounded-md bg-[var(--paper)] p-5 shadow-xl"><div className="mb-4 flex justify-between"><h2 className="serif text-xl">Report this review</h2><button type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button></div><fieldset className="grid gap-3">{reasons.map((item) => <label key={item.value} className="flex items-center gap-2 text-sm"><input type="radio" name="reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} />{item.label}</label>)}</fieldset><textarea className="field mt-4 min-h-20" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" /><div className="mt-4 flex justify-end"><button className="button" disabled={busy}>{busy ? "Sending…" : "Submit report"}</button></div></form></div>}
    {message && <span role="status" className="ml-2 text-xs text-[var(--muted)]">{message}</span>}
  </>;
}
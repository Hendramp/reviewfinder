"use client";

import { resolveSentiment, sentimentClasses, type Sentiment } from "@/lib/tag-sentiment";

type Props = { label: string; selected: boolean; onToggle?: () => void; note?: string | null; notePlaceholder?: string; onNoteChange?: (value: string) => void; count?: number };

type SentimentProps = { sentiment?: Sentiment; detail?: string | null };

export default function TagChip({ label, selected, onToggle, note, onNoteChange, count, sentiment, detail }: Props & SentimentProps) {
  const resolved = resolveSentiment({ label, sentiment }, detail ?? note);
  const colorClasses = sentimentClasses(resolved);
  return <div className="flex min-w-0 max-w-full flex-col gap-1 align-top">
    {onToggle ? <button type="button" aria-pressed={selected} onClick={onToggle} className={`min-h-11 max-w-full rounded-full border px-3 py-1.5 text-left text-sm [overflow-wrap:anywhere] transition-colors ${selected ? "border-[var(--green)] bg-[var(--green-light)] text-[var(--green)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"}`}>{label}</button> : <span className={`inline-flex min-h-11 max-w-full items-center rounded-full border px-3 py-1.5 text-xs [overflow-wrap:anywhere] ${colorClasses}`}>{label}{count !== undefined ? ` · ${count}` : ""}</span>}
    {detail && <span className="min-w-0 max-w-full break-words px-2 text-xs leading-5 text-[var(--muted)]">{detail}</span>}
    {selected && onNoteChange && <input className="field w-full min-w-0 px-3 py-2 text-xs" maxLength={140} value={note ?? ""} onChange={(event) => onNoteChange(event.target.value)} placeholder="Add a detail (optional)" />}
  </div>;
}
"use client";

type Props = { label: string; selected: boolean; onToggle?: () => void; note?: string | null; notePlaceholder?: string; onNoteChange?: (value: string) => void; count?: number };

export default function TagChip({ label, selected, onToggle, note, onNoteChange, count }: Props) {
  return <div className="inline-flex flex-col gap-1 align-top">
    {onToggle ? <button type="button" aria-pressed={selected} onClick={onToggle} className={`min-h-11 rounded-full border px-3 py-1.5 text-sm transition-colors ${selected ? "border-[var(--green)] bg-[var(--green-light)] text-[var(--green)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"}`}>{label}</button> : <span className="rounded-full bg-[var(--green-light)] px-3 py-1 text-xs text-[var(--green)]">{label}{count !== undefined ? ` · ${count}` : ""}</span>}
    {selected && onNoteChange && <input className="field min-w-48 px-3 py-2 text-xs" maxLength={140} value={note ?? ""} onChange={(event) => onNoteChange(event.target.value)} placeholder="Add a detail (optional)" />}
  </div>;
}
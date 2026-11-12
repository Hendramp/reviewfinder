"use client";

type Props = { value: number; onChange?: (value: number) => void; size?: "small" | "large" };

export default function StarRating({ value, onChange, size = "small" }: Props) {
  const interactive = Boolean(onChange);
  return <div className={`inline-flex items-center gap-2 ${size === "large" ? "text-2xl" : "text-base"}`} aria-label={value < 0 ? "Choose a rating" : `${value} out of 5 stars`}>
    <div className="flex" role={interactive ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((star) => interactive ? <button key={star} type="button" role="radio" aria-checked={value === star} aria-label={`${star} star${star === 1 ? "" : "s"}`} onClick={() => onChange?.(star)} className={`grid min-h-11 min-w-11 place-items-center ${star <= value ? "text-[var(--accent)]" : "text-[var(--muted)]"} cursor-pointer leading-none`}>&#9733;</button> : <span key={star} className={`${star <= value ? "text-[var(--accent)]" : "text-[var(--border)]"} leading-none`}>&#9733;</span>)}
    </div>
    {interactive && <button type="button" role="radio" aria-checked={value === 0} aria-label="0 stars" onClick={() => onChange?.(0)} className={`min-h-11 min-w-11 text-xs font-semibold ${value === 0 ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>0</button>}
    {!interactive && value === 0 && <span className="text-sm font-bold text-[var(--danger)]">0</span>}
  </div>;
}
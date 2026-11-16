"use client";

type Props = { value: number; onChange?: (value: number) => void; size?: "small" | "large" };

export default function StarRating({ value, onChange, size = "small" }: Props) {
  const interactive = Boolean(onChange);
  const selectedColor = value === 1
    ? "text-[#a77925]"
    : value === 2
      ? "text-[#bb8a2c]"
      : value === 3
        ? "text-[#d09f36]"
        : value === 4
          ? "text-[#e2b344]"
          : "text-[#f0c75e] drop-shadow-[0_1px_3px_rgb(192_143_42_/_0.45)]";
  return <div className={`inline-flex items-center gap-2 ${size === "large" ? "text-2xl" : "text-base"}`} aria-label={value < 0 ? "Choose a rating" : `${value} out of 5 stars`}>
    <div className="flex" role={interactive ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((star) => interactive ? <button key={star} type="button" role="radio" aria-checked={value === star} aria-label={`${star} star${star === 1 ? "" : "s"}`} onClick={() => onChange?.(star)} className={`grid min-h-11 min-w-11 place-items-center ${star <= value ? selectedColor : "text-[var(--muted)]"} cursor-pointer leading-none transition-colors`}>&#9733;</button> : <span key={star} className={`${star <= value ? selectedColor : "text-[var(--border)]"} leading-none`}>{star <= value ? "★" : "☆"}</span>)}
    </div>
    {interactive && <button type="button" role="radio" aria-checked={value === 0} aria-label="0 stars — a rough experience" onClick={() => onChange?.(0)} className={`min-h-10 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-colors ${value === 0 ? "border-[var(--earth)] bg-[var(--earth-soft)] text-[var(--earth)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--earth)] hover:text-[var(--earth)]"}`}>0 · Rough experience</button>}
    {!interactive && value === 0 && <span className="rounded-full bg-[var(--earth-soft)] px-2 py-1 text-xs font-semibold text-[var(--earth)]">0 · Rough experience</span>}
  </div>;
}
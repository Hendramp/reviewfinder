import Link from "next/link";
import StarRating from "@/components/StarRating";
import PhotoGrid from "@/components/PhotoGrid";
import ReportButton from "@/components/ReportButton";
import { formatDate } from "@/lib/format";
import type { Media, Review, Subject } from "@/lib/types";

export default function ReviewCard({ review, subject, photos, tags = [], tagNotes = [], bodyLimit }: { review: Review; subject?: Subject; photos: Media[]; tags?: string[]; tagNotes?: { label: string; note: string }[]; bodyLimit?: number }) {
  const body = review.body && bodyLimit && review.body.length > bodyLimit ? `${review.body.slice(0, bodyLimit).trimEnd()}…` : review.body;
  const stayDetails = subject?.kind === "stay" ? [
    review.nightly_cost !== null ? `$${review.nightly_cost.toLocaleString("en-US")} per night` : null,
    review.stay_nights !== null ? `${review.stay_nights} ${review.stay_nights === 1 ? "night" : "nights"}` : null,
  ].filter(Boolean).join(" · ") : "";
  const leaseDetails = subject?.kind === "lease" ? [
    review.monthly_cost !== null ? `$${review.monthly_cost.toLocaleString("en-US")} per month` : null,
    review.lease_months !== null ? `${review.lease_months}-month lease` : null,
  ].filter(Boolean).join(" · ") : "";
  return <article id={`review-${review.id}`} className="review-card">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><StarRating value={review.rating} /><span className="text-xs text-[var(--muted)]">{formatDate(review.visit_date ?? review.created_at)}</span></div>
      {review.rating === 0 && <span className="rounded-sm bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--danger)]">0 stars</span>}
    </div>
    {subject && <Link href={`/s/${subject.id}`} className="mt-2 inline-block text-sm font-semibold text-[var(--green)]">{subject.display_name}</Link>}
    {(stayDetails || leaseDetails) && <p className="mt-1 text-xs text-[var(--muted)]">{stayDetails || leaseDetails}</p>}
    {body && <p className="my-3 whitespace-pre-wrap text-[15px] leading-7">{body}</p>}
    {tags.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--green-light)] px-2.5 py-1 text-xs text-[var(--green)]">{tag}</span>)}</div>}
    {tagNotes.map((tag) => tag.note && <p key={`${tag.label}-${tag.note}`} className="-mt-2 mb-2 text-xs italic text-[var(--muted)]">{tag.label}: {tag.note}</p>)}
    <PhotoGrid photos={photos} />
    <div className="mt-3"><ReportButton reviewId={review.id} /></div>
  </article>;
}
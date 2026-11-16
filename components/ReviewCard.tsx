import Link from "next/link";
import StarRating from "@/components/StarRating";
import PhotoGrid from "@/components/PhotoGrid";
import ReportButton from "@/components/ReportButton";
import TagChip from "@/components/TagChip";
import { formatDate } from "@/lib/format";
import type { Sentiment } from "@/lib/tag-sentiment";
import type { Media, Review, Subject } from "@/lib/types";

type ReviewTagDisplay = { label: string; sentiment?: Sentiment; note?: string | null };

export default function ReviewCard({ review, subject, photos, tags = [], bodyLimit }: { review: Review; subject?: Subject; photos: Media[]; tags?: ReviewTagDisplay[]; bodyLimit?: number }) {
  const body = review.body && bodyLimit && review.body.length > bodyLimit ? `${review.body.slice(0, bodyLimit).trimEnd()}…` : review.body;
  const stayDetails = subject?.kind === "stay" ? [
    review.nightly_cost !== null ? `$${review.nightly_cost.toLocaleString("en-US")} per night` : null,
    review.stay_nights !== null ? `${review.stay_nights} ${review.stay_nights === 1 ? "night" : "nights"}` : null,
  ].filter(Boolean).join(" · ") : "";
  const leaseDetails = subject?.kind === "lease" ? [
    review.monthly_cost !== null ? `$${review.monthly_cost.toLocaleString("en-US")} per month` : null,
    review.lease_months !== null ? `${review.lease_months}-month lease` : null,
  ].filter(Boolean).join(" · ") : "";
  return <article id={`review-${review.id}`} className="review-card min-w-0 max-w-full">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><StarRating value={review.rating} /><span className="text-xs text-[var(--muted)]">{formatDate(review.visit_date ?? review.created_at)}</span></div>
      {review.rating === 0 && <span className="rounded-sm bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--danger)]">0 stars</span>}
    </div>
    {subject && <Link href={`/s/${subject.id}`} className="mt-2 inline-block max-w-full break-words text-sm font-semibold text-[var(--green)] [overflow-wrap:anywhere]">{subject.display_name}</Link>}
    {(stayDetails || leaseDetails) && <p className="mt-1 text-xs text-[var(--muted)]">{stayDetails || leaseDetails}</p>}
    {body && <p className="my-3 min-w-0 break-words whitespace-pre-wrap text-[15px] leading-7 [overflow-wrap:anywhere]">{body}</p>}
    {tags.length > 0 && <div className="mb-3 flex min-w-0 flex-wrap items-start gap-2">{tags.map((tag) => <TagChip key={`${tag.label}-${tag.note ?? ""}`} label={tag.label} selected={false} sentiment={tag.sentiment} detail={tag.note} />)}</div>}
    <PhotoGrid photos={photos} />
    <div className="mt-3"><ReportButton reviewId={review.id} /></div>
  </article>;
}
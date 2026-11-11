import Link from "next/link";
import StarRating from "@/components/StarRating";
import PhotoGrid from "@/components/PhotoGrid";
import ReportButton from "@/components/ReportButton";
import { formatDate } from "@/lib/format";
import type { Media, Review, Subject } from "@/lib/types";

export default function ReviewCard({ review, subject, photos, tags = [], tagNotes = [], bodyLimit }: { review: Review; subject?: Subject; photos: Media[]; tags?: string[]; tagNotes?: { label: string; note: string }[]; bodyLimit?: number }) {
  const body = review.body && bodyLimit && review.body.length > bodyLimit ? `${review.body.slice(0, bodyLimit).trimEnd()}…` : review.body;
  return <article className="border-b border-[var(--line)] py-6 last:border-0">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><StarRating value={review.rating} /><span className="text-xs text-[var(--muted)]">{formatDate(review.visit_date ?? review.created_at)}</span></div>
      {review.rating === 0 && <span className="rounded-sm bg-[#f7e8e2] px-2 py-1 text-[10px] font-bold uppercase text-[var(--coral)]">0 stars</span>}
    </div>
    {subject && <Link href={`/s/${subject.id}`} className="mt-2 inline-block text-sm font-semibold text-[var(--green)]">{subject.display_name}</Link>}
    {body && <p className="my-3 whitespace-pre-wrap text-[15px] leading-7">{body}</p>}
    {tags.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--green-light)] px-2.5 py-1 text-xs text-[var(--green)]">{tag}</span>)}</div>}
    {tagNotes.map((tag) => tag.note && <p key={`${tag.label}-${tag.note}`} className="-mt-2 mb-2 text-xs italic text-[var(--muted)]">{tag.label}: {tag.note}</p>)}
    <PhotoGrid photos={photos} />
    <div className="mt-3"><ReportButton reviewId={review.id} /></div>
  </article>;
}
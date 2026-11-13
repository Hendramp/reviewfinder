import Link from "next/link";
import { notFound } from "next/navigation";
import DistributionBar from "@/components/DistributionBar";
import ReviewCard from "@/components/ReviewCard";
import TagChip from "@/components/TagChip";
import { createClient } from "@/lib/supabase/server";
import type { Media, Review, ReviewTag, Subject, SubjectStats, Tag } from "@/lib/types";

function listingLabel(sourceUrl: string) {
  try {
    const domain = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
    if (domain === "airbnb.com" || domain.endsWith(".airbnb.com")) return "Airbnb";
    if (domain === "vrbo.com" || domain.endsWith(".vrbo.com")) return "Vrbo";
    if (domain === "furnishedfinder.com" || domain.endsWith(".furnishedfinder.com")) return "Furnished Finder";
    return domain;
  } catch {
    return "listing";
  }
}

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: subject } = await supabase.from("subjects").select("*").eq("id", id).maybeSingle();
  if (!subject) notFound();
  const [{ data: stats }, { data: reviews }] = await Promise.all([
    supabase.from("subject_stats").select("*").eq("subject_id", id).maybeSingle(),
    supabase.from("reviews").select("*").eq("subject_id", id).eq("status", "published").order("created_at", { ascending: false }),
  ]);
  const reviewList = ((reviews ?? []) as Review[]).sort((a, b) => Number(b.rating === 0) - Number(a.rating === 0) || b.created_at.localeCompare(a.created_at));
  const reviewIds = reviewList.map((review) => review.id);
  const [{ data: media }, { data: associations }, { data: tags }] = reviewIds.length ? await Promise.all([
    supabase.from("media").select("*").in("review_id", reviewIds).eq("kind", "photo").eq("status", "ready").order("position"),
    supabase.from("review_tags").select("*").in("review_id", reviewIds).eq("value", true),
    supabase.from("tags").select("*").eq("kind", subject.kind),
  ]) : [{ data: [] as Media[] }, { data: [] as ReviewTag[] }, { data: [] as Tag[] }];
  const tagMap = new Map((tags ?? []).map((tag) => [tag.id, tag]));
  const mediaByReview = new Map<string, Media[]>();
  for (const photo of media ?? []) mediaByReview.set(photo.review_id, [...(mediaByReview.get(photo.review_id) ?? []), photo]);
  const tagsByReview = new Map<string, ReviewTag[]>();
  for (const association of associations ?? []) tagsByReview.set(association.review_id, [...(tagsByReview.get(association.review_id) ?? []), association]);
  const counts = new Map<number, number>();
  for (const association of associations ?? []) counts.set(association.tag_id, (counts.get(association.tag_id) ?? 0) + 1);
  const tagTallies = [...(tags ?? [])].map((tag) => ({ tag, count: counts.get(tag.id) ?? 0 })).filter(({ count }) => count > 0).sort((a, b) => b.count - a.count);
  const ratingStats: SubjectStats = stats ?? { subject_id: id, review_count: 0, avg_rating: null, zeros: 0, ones: 0, twos: 0, threes: 0, fours: 0, fives: 0, last_visit: null };
  const visitor = subject.kind === "lease" ? "tenants" : "guests";
  const kindLabel = subject.kind === "stay" ? "Stay" : subject.kind === "hotel" ? "Hotel" : "Lease";

  return <div className="page-shell pb-16">
    <header className="border-b border-[var(--line)] py-9"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0"><p className="eyebrow">{kindLabel}</p><h1 className="serif mt-2 break-words text-4xl sm:text-5xl">{subject.display_name}</h1><p className="mt-3 break-words text-sm text-[var(--muted)]">{[subject.address, subject.city, subject.region].filter(Boolean).join(" · ")}</p>{subject.kind === "stay" && subject.host_name && <p className="mt-2 text-sm">Hosted by {subject.host_name}</p>}</div><div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">{subject.kind === "stay" && subject.source_url && <><a aria-label={`View original listing on ${listingLabel(subject.source_url)}`} className="min-h-11 content-center break-all text-sm font-semibold text-[var(--accent)] underline underline-offset-4" href={subject.source_url} target="_blank" rel="noopener noreferrer">View original listing ↗</a><span className="text-xs text-[var(--muted)]">{listingLabel(subject.source_url)}</span></>}<Link className="button" href={`/write?subject=${subject.id}`}>Write a review</Link></div></div></header>
    <section className="grid gap-8 border-b border-[var(--line)] py-7 sm:grid-cols-[1fr_2fr]">
      <div><p className="eyebrow">Community rating</p><div className="mt-1 flex items-baseline gap-2"><span className="serif text-5xl">{ratingStats.avg_rating === null ? "—" : Number(ratingStats.avg_rating).toFixed(1)}</span><span className="text-sm text-[var(--muted)]">/ 5</span></div><p className="mt-1 text-xs text-[var(--muted)]">0-5 scale · {ratingStats.review_count} reviews</p></div>
      <div className="self-center"><DistributionBar stats={ratingStats} /></div>
      {ratingStats.zeros > 0 && <p className="sm:col-span-2 text-sm font-medium text-[var(--danger)]">{ratingStats.zeros} of {ratingStats.review_count} {visitor} rated this {subject.kind === "lease" ? "lease" : "stay"} zero stars.</p>}
    </section>
    {tagTallies.length > 0 && <section className="border-b border-[var(--line)] py-6"><p className="eyebrow mb-3">What people mention</p><div className="flex flex-wrap gap-2">{tagTallies.map(({ tag, count }) => <TagChip key={tag.id} label={tag.label} selected={false} count={count} />)}</div></section>}
    <section className="pt-7"><div className="mb-1 flex items-baseline justify-between"><h2 className="serif text-2xl">Reviews</h2><span className="text-xs text-[var(--muted)]">{reviewList.length}</span></div>
      {reviewList.length ? reviewList.map((review) => {
        const associationsForReview = tagsByReview.get(review.id) ?? [];
        const namedTags = associationsForReview.map((association) => tagMap.get(association.tag_id)).filter((tag): tag is Tag => Boolean(tag));
        return <ReviewCard key={review.id} review={review} photos={(mediaByReview.get(review.id) ?? []).slice(0, 8)} tags={namedTags.map((tag) => tag.label)} tagNotes={associationsForReview.flatMap((association) => { const tag = tagMap.get(association.tag_id); return tag && association.note ? [{ label: tag.label, note: association.note }] : []; })} />;
      }) : <div className="empty-state mt-5"><p className="eyebrow">First impressions start somewhere</p><p className="serif mt-1 text-2xl">No one has written about {subject.display_name} yet.</p><p className="mt-2 text-sm text-[var(--muted)]">You could be the person who helps someone choose it with confidence.</p><Link className="button mt-4" href={`/write?subject=${subject.id}`}>Write the first review</Link></div>}
    </section>
  </div>;
}
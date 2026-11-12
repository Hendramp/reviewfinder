import Link from "next/link";
import ReviewCard from "@/components/ReviewCard";
import { searchSubjects } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import type { Media, Subject, SubjectKind, SubjectStats } from "@/lib/types";

type Params = Promise<{ q?: string }>;
const categories: { kind: SubjectKind; label: string; slug: string; description: string }[] = [
  { kind: "stay", label: "Stays", slug: "stays", description: "Airbnb, Vrbo, and Furnished Finder" },
  { kind: "hotel", label: "Hotels", slug: "hotels", description: "Hotels, honestly reviewed" },
  { kind: "lease", label: "Leases", slug: "leases", description: "Apartments for any term length" },
];

export default async function Home({ searchParams }: { searchParams: Params }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const [results, recentResult, categorySubjectsResult] = await Promise.all([
    q ? searchSubjects(q) : Promise.resolve([]),
    supabase.from("reviews").select("*").eq("status", "published").order("created_at", { ascending: false }).limit(24),
    supabase.from("subjects").select("id,kind").in("kind", categories.map((category) => category.kind)),
  ]);
  const categorySubjects = categorySubjectsResult.data ?? [];
  const subjectIdsForStats = categorySubjects.map((subject) => subject.id);
  const { data: categoryStats } = subjectIdsForStats.length
    ? await supabase.from("subject_stats").select("subject_id,review_count").in("subject_id", subjectIdsForStats)
    : { data: [] as Pick<SubjectStats, "subject_id" | "review_count">[] };
  const subjectKinds = new Map(categorySubjects.map((subject) => [subject.id, subject.kind]));
  const reviewCounts = new Map<SubjectKind, number>(categories.map((category) => [category.kind, 0]));
  for (const stat of categoryStats ?? []) {
    const kind = subjectKinds.get(stat.subject_id) as SubjectKind | undefined;
    if (kind) reviewCounts.set(kind, (reviewCounts.get(kind) ?? 0) + stat.review_count);
  }
  const initialReviews = recentResult.data ?? [];
  const initialIds = [...new Set(initialReviews.map((review) => review.subject_id))];
  const { data: initialSubjects } = initialIds.length
    ? await supabase.from("subjects").select("*").in("id", initialIds)
    : { data: [] as Subject[] };
  const subjects = new Map((initialSubjects ?? []).map((subject) => [subject.id, subject]));
  const recent = initialReviews.filter((review) => ["stay", "hotel", "lease"].includes(subjects.get(review.subject_id)?.kind ?? ""));
  const recentIds = recent.map((review) => review.id);
  const { data: media } = recentIds.length
    ? await supabase.from("media").select("*").in("review_id", recentIds).eq("kind", "photo").eq("status", "ready").order("position")
    : { data: [] as Media[] };
  const mediaByReview = new Map<string, Media[]>();
  for (const photo of media ?? []) mediaByReview.set(photo.review_id, [...(mediaByReview.get(photo.review_id) ?? []), photo]);
  const visibleResults = results.filter((subject) => ["stay", "hotel", "lease"].includes(subject.kind));

  return <div className="page-shell pb-16">
    <section className="hero-panel mt-5 overflow-hidden rounded-2xl border px-5 py-8 sm:mt-8 sm:px-10 sm:py-12">
      <div className="hero-layout">
        <div className="hero-copy fade-in"><p className="hero-kicker"><span aria-hidden="true" />Real places. Real experiences.</p><h1 className="serif mt-4 max-w-2xl text-4xl leading-[1.03] sm:text-6xl">Pillow talk,<br /><em>unfiltered.</em></h1><p className="mt-5 max-w-xl text-base leading-7 text-[var(--muted)]">Honest reviews from people who were really there, with photos to show what a stay, hotel, or lease was actually like.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/write" className="button">Write a review <span aria-hidden="true">↗</span></Link><Link href="/browse?category=stays" className="button button-secondary">Browse stays</Link></div>
          <div className="hero-signals mt-7"><span><strong>01</strong> Original listing links</span><span><strong>02</strong> Reviewer photos</span><span><strong>03</strong> The full 0–5 scale</span></div>
        </div>
        <aside className="hero-proof-card fade-in" aria-label="What makes a useful review">
          <div className="flex items-center justify-between gap-3"><span className="eyebrow">The useful details</span><span className="hero-card-mark" aria-hidden="true">U</span></div>
          <h2 className="serif mt-4 text-2xl leading-tight">More than a star rating.</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">A clearer picture of the place before you commit.</p>
          <ul className="mt-5 grid gap-3">
            <li><span className="hero-detail-icon" aria-hidden="true">↗</span><span><strong>Go to the source</strong><small>Every place links to its original listing.</small></span></li>
            <li><span className="hero-detail-icon" aria-hidden="true">▧</span><span><strong>See the real space</strong><small>Reviews can include photos from the visit.</small></span></li>
            <li><span className="hero-detail-icon" aria-hidden="true">0–5</span><span><strong>Room for the whole story</strong><small>Good, bad, and everything between.</small></span></li>
          </ul>
        </aside>
      </div>
    </section>
    <section className="py-9 sm:py-12"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Start with the kind of place</p><h2 className="serif mt-1 text-3xl">Find your kind of place.</h2></div><span className="text-xs font-medium text-[var(--muted)]">Live community review counts</span></div>
      <div className="grid gap-3 sm:grid-cols-3">{categories.map((category, index) => <Link key={category.kind} href={`/browse?category=${category.slug}`} className={`category-card group min-w-0 rounded-xl border p-5 no-underline transition-all ${index === 0 ? "category-card-primary" : ""}`}><div className="flex items-center justify-between"><span className="category-index">0{index + 1}</span><span className="category-arrow" aria-hidden="true">↗</span></div><p className="serif mt-5 text-2xl">{category.label}</p><p className="mt-1 min-h-10 text-sm leading-5 text-[var(--muted)]">{category.description}</p><p className="mt-5 border-t border-[var(--border)] pt-3"><strong className="serif text-2xl">{reviewCounts.get(category.kind) ?? 0}</strong><span className="ml-2 text-xs text-[var(--muted)]">community reviews</span></p></Link>)}</div>
    </section>
    <section id="search" className="scroll-mt-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Find a place</p><h2 className="serif mt-1 text-2xl">Search the reviews</h2></div><Link href="/browse?category=stays" className="text-sm font-semibold text-[var(--accent)]">Browse all places →</Link></div>
      <form className="mt-4 flex max-w-xl gap-2"><input className="field min-w-0" name="q" defaultValue={q} placeholder="Name or city" aria-label="Search by name or city" /><button className="button">Search</button></form>
      {q && <div className="mt-4 space-y-2">{visibleResults.length ? visibleResults.map((subject) => <Link key={subject.id} href={`/s/${subject.id}`} className="flex min-h-11 justify-between gap-3 border-b border-[var(--line)] py-3 text-sm no-underline"><span className="break-words">{subject.display_name}</span><span className="shrink-0 text-[var(--muted)]">{subject.city ?? subject.kind}</span></Link>) : <div className="empty-state mt-5"><p className="eyebrow">A fresh start</p><p className="serif mt-1 text-2xl">No place by that name yet.</p><Link className="button mt-4" href={`/write?input=${encodeURIComponent(q)}`}>Start its first review</Link></div>}</div>}
    </section>
    <section className="py-4"><div className="mb-5 flex items-end justify-between"><div><p className="eyebrow">Fresh from the community</p><h2 className="serif mt-1 text-2xl">Recent reviews</h2></div></div>
      <div className="grid gap-3">{recent.map((review) => <div key={review.id}><ReviewCard review={review} subject={subjects.get(review.subject_id)} photos={(mediaByReview.get(review.id) ?? []).slice(0, 1)} bodyLimit={120} /></div>)}{recent.length === 0 && <div className="empty-state mt-6"><p className="eyebrow">The first page is yours</p><p className="serif mt-1 text-2xl">No reviews here yet.</p><p className="mt-2 max-w-md text-sm text-[var(--muted)]">Every place has a story. Yours can be the first one people read.</p><Link className="button mt-4" href="/write">Write the first review</Link></div>}</div>
    </section>
  </div>;
}

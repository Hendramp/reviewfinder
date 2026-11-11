import Link from "next/link";
import CategoryTabs from "@/components/CategoryTabs";
import ReviewCard from "@/components/ReviewCard";
import { searchSubjects } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import type { Media, Subject, SubjectKind } from "@/lib/types";

type Params = Promise<{ q?: string; kind?: string }>;

export default async function Home({ searchParams }: { searchParams: Params }) {
  const { q = "", kind = "all" } = await searchParams;
  const supabase = await createClient();
  const [results, recentResult] = await Promise.all([
    q ? searchSubjects(q) : Promise.resolve([]),
    supabase.from("reviews").select("*").eq("status", "published").order("created_at", { ascending: false }).limit(12),
  ]);
  let recent = recentResult.data ?? [];
  const recentSubjectIds = [...new Set(recent.map((review) => review.subject_id))];
  const [subjectsResult, mediaResult] = recent.length ? await Promise.all([
    supabase.from("subjects").select("*").in("id", recentSubjectIds),
    supabase.from("media").select("*").in("review_id", recent.map((review) => review.id)).eq("kind", "photo").eq("status", "ready").order("position"),
  ]) : [{ data: [] as Subject[] }, { data: [] as Media[] }];
  const subjects = new Map((subjectsResult.data ?? []).map((subject) => [subject.id, subject]));
  const media = new Map<string, Media[]>();
  for (const photo of mediaResult.data ?? []) media.set(photo.review_id, [...(media.get(photo.review_id) ?? []), photo]);
  if (kind !== "all") recent = recent.filter((review) => subjects.get(review.subject_id)?.kind === kind);

  return <div className="page-shell pb-16">
    <section className="hero-panel relative -mx-[max(18px,calc((100vw-1120px)/2))] overflow-hidden border-b border-[#d7b747] px-[max(18px,calc((100vw-1120px)/2))] py-12 sm:py-16">
      <div className="relative max-w-3xl fade-in"><p className="eyebrow">For the places that stay with you</p><h1 className="serif mt-3 max-w-2xl text-4xl leading-[1.07] sm:text-6xl">A little more honesty. <em className="text-[var(--coral)]">A lot more heart.</em></h1><p className="mt-4 max-w-xl text-[#49574d]">Find the lovely surprises, the little details, and the full story.</p>
        <form action="/write" className="mt-8 flex max-w-2xl flex-col gap-2 rounded-md border border-[#d6c173] bg-[#fffdf8] p-2 shadow-[0_5px_0_rgba(87,67,24,.12)] sm:flex-row"><input name="input" className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 outline-none" placeholder="Paste an Airbnb link or name a place" aria-label="Airbnb link or place name" /><button className="button">Write a review <span aria-hidden="true">↗</span></button></form>
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2"><span className="text-sm font-medium">Just here to look around?</span><Link href="/browse" className="button button-secondary">Explore reviews <span aria-hidden="true">↗</span></Link><span className="text-xs text-[var(--muted)]">No account needed.</span></div>
      </div>
    </section>
    <section className="py-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Find a place</p><h2 className="serif mt-1 text-2xl">Search the reviews</h2></div><Link href="/browse" className="text-sm font-semibold text-[var(--green)]">Browse all places →</Link></div>
      <form className="mt-4 flex max-w-xl gap-2"><input className="field" name="q" defaultValue={q} placeholder="Name or city" aria-label="Search by name or city" /><button className="button">Search</button></form>
      {q && <div className="mt-4 space-y-2">{results.length ? results.map((subject) => <Link key={subject.id} href={`/s/${subject.id}`} className="flex justify-between border-b border-[var(--line)] py-3 text-sm no-underline"><span>{subject.display_name}</span><span className="text-[var(--muted)]">{subject.city ?? subject.kind}</span></Link>) : <div className="empty-state mt-5"><p className="eyebrow">A fresh start</p><p className="serif mt-1 text-2xl">No place by that name yet.</p><Link className="button mt-4" href={`/write?input=${encodeURIComponent(q)}`}>Start its first review</Link></div>}</div>}
    </section>
    <section className="py-4"><div className="mb-5 flex items-end justify-between"><div><p className="eyebrow">Fresh from the community</p><h2 className="serif mt-1 text-2xl">Recent reviews</h2></div></div><CategoryTabs active={(["stay", "hotel", "restaurant", "bar"].includes(kind) ? kind : "all") as SubjectKind | "all"} base="/" />
      <div className="divide-y divide-[var(--line)]">{recent.map((review) => <div key={review.id}><ReviewCard review={review} subject={subjects.get(review.subject_id)} photos={(media.get(review.id) ?? []).slice(0, 1)} bodyLimit={120} /></div>)}{recent.length === 0 && <div className="empty-state mt-6"><p className="eyebrow">The first page is yours</p><p className="serif mt-1 text-2xl">No reviews here yet.</p><p className="mt-2 max-w-md text-sm text-[var(--muted)]">Every place has a story. Yours can be the first one people read.</p><Link className="button mt-4" href="/write">Write the first review</Link></div>}</div>
    </section>
  </div>;
}
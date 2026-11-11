import Link from "next/link";
import CategoryTabs from "@/components/CategoryTabs";
import StarRating from "@/components/StarRating";
import { createClient } from "@/lib/supabase/server";
import type { Subject, SubjectKind, SubjectStats } from "@/lib/types";

type Params = Promise<{ kind?: string; place_type?: string; price_tier?: string; zeros?: string; city?: string }>;

export default async function Browse({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const kind = (["stay", "hotel", "restaurant", "bar"].includes(params.kind ?? "") ? params.kind : "all") as SubjectKind | "all";
  const supabase = await createClient();
  let query = supabase.from("subjects").select("*").order("display_name");
  if (kind !== "all") query = query.eq("kind", kind);
  if (kind === "stay" && params.place_type) query = query.eq("place_type", params.place_type);
  if (kind === "hotel" && params.price_tier) query = query.eq("price_tier", Number(params.price_tier));
  if ((kind === "restaurant" || kind === "bar") && params.city) query = query.ilike("city", `%${params.city.replace(/[%_]/g, " ")}%`);
  const { data: subjects } = await query.limit(120) as { data: Subject[] | null };
  const ids = (subjects ?? []).map((subject) => subject.id);
  const { data: stats } = ids.length ? await supabase.from("subject_stats").select("*").in("subject_id", ids) : { data: [] as SubjectStats[] };
  const statsById = new Map((stats ?? []).map((item) => [item.subject_id, item]));
  const cards = (subjects ?? []).filter((subject) => {
    const item = statsById.get(subject.id);
    return (!params.zeros || params.zeros !== "true" || (item?.zeros ?? 0) > 0) && (item?.review_count ?? 0) > 0;
  });
  return <div className="page-shell min-h-[70vh] py-10">
    <p className="eyebrow">The places, honestly reviewed</p><h1 className="serif mt-2 text-4xl">Browse</h1><p className="mt-2 text-sm text-[var(--muted)]">Take your time. You can read everything without an account.</p>
    <div className="mt-7"><CategoryTabs active={kind} /></div>
    {kind !== "all" && <form className="flex flex-wrap items-end gap-3 border-b border-[var(--line)] py-5"><input type="hidden" name="kind" value={kind} />
      {kind === "stay" && <label className="grid gap-1 text-xs text-[var(--muted)]">Place type<select name="place_type" defaultValue={params.place_type ?? ""} className="field min-w-36 py-2"><option value="">Any</option><option value="whole">Entire place</option><option value="private">Private room</option><option value="shared">Shared room</option></select></label>}
      {kind === "hotel" && <label className="grid gap-1 text-xs text-[var(--muted)]">Price tier<select name="price_tier" defaultValue={params.price_tier ?? ""} className="field min-w-32 py-2"><option value="">Any</option>{[1, 2, 3, 4].map((tier) => <option key={tier} value={tier}>{"$".repeat(tier)}</option>)}</select></label>}
      {(kind === "restaurant" || kind === "bar") && <label className="grid gap-1 text-xs text-[var(--muted)]">City<input name="city" defaultValue={params.city ?? ""} className="field min-w-40 py-2" /></label>}
      <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="zeros" value="true" defaultChecked={params.zeros === "true"} />Has zero-star reviews</label><button className="button button-secondary">Apply</button>
    </form>}
    {cards.length ? <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">{cards.map((subject) => { const stat = statsById.get(subject.id); return <Link key={subject.id} href={`/s/${subject.id}`} className="border-b border-[var(--line)] py-5 no-underline transition-colors hover:bg-[#fff1dc]"><span className="eyebrow">{subject.kind}</span><h2 className="serif mt-1 text-xl">{subject.display_name}</h2><p className="mt-1 text-sm text-[var(--muted)]">{[subject.city, subject.region].filter(Boolean).join(", ")}</p><div className="mt-3 flex items-center gap-2"><strong className="text-xl">{stat?.avg_rating?.toFixed(1) ?? "—"}</strong><StarRating value={Math.round(stat?.avg_rating ?? 0)} /><span className="text-xs text-[var(--muted)]">{stat?.review_count} reviews</span></div>{(stat?.zeros ?? 0) > 0 && <p className="mt-2 text-xs text-[var(--coral)]">{stat?.zeros} guests rated this zero stars</p>}</Link>; })}</div> : <div className="empty-state mt-8"><p className="eyebrow">A lovely place to begin</p><p className="serif mt-1 text-3xl">No reviews here yet. Be the first.</p><p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">The best recommendations start with one person taking the time to share what it was really like.</p><Link className="button mt-5" href="/write">Write the first review <span aria-hidden="true">↗</span></Link></div>}
  </div>;
}
import Link from "next/link";
import CategoryTabs from "@/components/CategoryTabs";
import StarRating from "@/components/StarRating";
import { createClient } from "@/lib/supabase/server";
import type { Subject, SubjectKind, SubjectStats } from "@/lib/types";

type Params = Promise<{ category?: string; kind?: string; place_type?: string; price_tier?: string; zeros?: string; term?: string; q?: string }>;
const categoryKinds: Record<string, SubjectKind> = { stays: "stay", hotels: "hotel", leases: "lease" };

export default async function Browse({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const kind = categoryKinds[params.category ?? ""] ?? (["stay", "hotel", "lease"].includes(params.kind ?? "") ? params.kind as SubjectKind : "stay");
  const term = kind === "lease" && (params.term === "short" || params.term === "long") ? params.term : "";
  const searchTerm = params.q?.trim().replace(/[%_]/g, " ") ?? "";
  const supabase = await createClient();
  const createSubjectsQuery = () => {
    let query = supabase.from("subjects").select("*").eq("kind", kind).order("display_name");
    if ((kind === "stay" || kind === "lease") && params.place_type) query = query.eq("place_type", params.place_type);
    if (params.price_tier) query = query.eq("price_tier", Number(params.price_tier));
    return query;
  };
  let subjects: Subject[] | null;
  let searchError: string | null = null;
  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    const [byName, byCity] = await Promise.all([
      createSubjectsQuery().ilike("display_name", pattern).limit(120),
      createSubjectsQuery().ilike("city", pattern).limit(120),
    ]);
    searchError = byName.error?.message ?? byCity.error?.message ?? null;
    subjects = [...new Map([...(byName.data ?? []), ...(byCity.data ?? [])].map((subject) => [subject.id, subject])).values()];
  } else {
    const result = await createSubjectsQuery().limit(120);
    searchError = result.error?.message ?? null;
    subjects = result.data as Subject[] | null;
  }
  const ids = (subjects ?? []).map((subject) => subject.id);
  const [{ data: stats }, { data: leaseReviews }] = await Promise.all([
    ids.length ? supabase.from("subject_stats").select("*").in("subject_id", ids) : Promise.resolve({ data: [] as SubjectStats[] }),
    kind === "lease" && term && ids.length
      ? supabase.from("reviews").select("subject_id,lease_months").in("subject_id", ids).eq("status", "published").not("lease_months", "is", null)
      : Promise.resolve({ data: [] as { subject_id: string; lease_months: number | null }[] }),
  ]);
  const statsById = new Map((stats ?? []).map((item) => [item.subject_id, item]));
  const leaseMatches = new Set((leaseReviews ?? []).filter((review) => term === "short" ? review.lease_months !== null && review.lease_months < 12 : review.lease_months !== null && review.lease_months >= 12).map((review) => review.subject_id));
  const cards = (subjects ?? []).filter((subject) => {
    const item = statsById.get(subject.id);
    return (!params.zeros || params.zeros !== "true" || (item?.zeros ?? 0) > 0) &&
      (item?.review_count ?? 0) > 0 && (!term || leaseMatches.has(subject.id));
  });
  return <div className="page-shell min-h-[70vh] py-10">
    <p className="eyebrow">The places, honestly reviewed</p><h1 className="serif mt-2 text-4xl">Browse {kind === "stay" ? "stays" : kind === "hotel" ? "hotels" : "leases"}</h1><p className="mt-2 text-sm text-[var(--muted)]">Take your time. You can read everything without an account.</p>
    <div className="mt-7"><CategoryTabs active={kind} /></div>
    <form className="flex flex-wrap items-end gap-3 border-b border-[var(--line)] py-5"><input type="hidden" name="category" value={kind === "stay" ? "stays" : kind === "hotel" ? "hotels" : "leases"} />
      <label className="grid w-full max-w-sm gap-1 text-xs text-[var(--muted)]">Search by name or city<input type="search" name="q" defaultValue={params.q ?? ""} placeholder="Name or city" className="field py-2" /></label>
      {(kind === "stay" || kind === "lease") && <label className="grid gap-1 text-xs text-[var(--muted)]">Place type<select name="place_type" defaultValue={params.place_type ?? ""} className="field min-w-36 py-2"><option value="">Any</option><option value="whole">Entire place</option><option value="private">Private room</option>{kind !== "lease" && <option value="shared">Shared room</option>}</select></label>}
      <label className="grid gap-1 text-xs text-[var(--muted)]">Price tier<select name="price_tier" defaultValue={params.price_tier ?? ""} className="field min-w-32 py-2"><option value="">Any</option>{[1, 2, 3, 4].map((tier) => <option key={tier} value={tier}>{"$".repeat(tier)}</option>)}</select></label>
      {kind === "lease" && <fieldset className="grid gap-1 text-xs text-[var(--muted)]"><legend>Lease length</legend><div className="flex gap-2"><label className="flex min-h-11 items-center gap-2"><input type="radio" name="term" value="short" defaultChecked={term === "short"} />Short-term (under a year)</label><label className="flex min-h-11 items-center gap-2"><input type="radio" name="term" value="long" defaultChecked={term === "long"} />Long-term (a year or more)</label></div></fieldset>}
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="zeros" value="true" defaultChecked={params.zeros === "true"} />Has zero-star reviews</label><button className="button button-secondary">{searchTerm ? "Search & apply filters" : "Apply filters"}</button>
    </form>
    {searchError && <p role="alert" className="mt-4 text-sm text-[var(--accent)]">Could not load places: {searchError}</p>}
    {cards.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map((subject) => { const stat = statsById.get(subject.id); return <Link key={subject.id} href={`/s/${subject.id}`} className="browse-card block min-w-0 no-underline"><span className="eyebrow">{kind === "stay" ? "Stay" : kind === "hotel" ? "Hotel" : "Lease"}</span><h2 className="serif mt-1 break-words text-xl">{subject.display_name}</h2><p className="mt-1 break-words text-sm text-[var(--muted)]">{[subject.city, subject.region].filter(Boolean).join(", ")}</p><div className="mt-3 flex flex-wrap items-center gap-2"><strong className="text-xl">{stat?.avg_rating?.toFixed(1) ?? "—"}</strong><StarRating value={Math.round(stat?.avg_rating ?? 0)} /><span className="text-xs text-[var(--muted)]">{stat?.review_count} reviews</span></div>{(stat?.zeros ?? 0) > 0 && <p className="mt-2 text-xs text-[var(--danger)]">{stat?.zeros} guests rated this zero stars</p>}</Link>; })}</div> : <div className="empty-state mt-8"><p className="eyebrow">A lovely place to begin</p><p className="serif mt-1 text-3xl">{searchTerm ? "No matching places yet." : "No reviews here yet. Be the first."}</p><p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">The best recommendations start with one person taking the time to share what it was really like.</p><Link className="button mt-5" href="/write">Write the first review <span aria-hidden="true">↗</span></Link></div>}
  </div>;
}

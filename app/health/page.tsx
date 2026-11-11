import { createClient } from "@/lib/supabase/server";
import type { Tag } from "@/lib/types";

export default async function HealthPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tags").select("*").order("kind").order("label");
  const grouped = ((data ?? []) as Tag[]).reduce<Record<string, string[]>>((result, tag) => { result[tag.kind] = [...(result[tag.kind] ?? []), tag.label]; return result; }, {});
  return <div className="page-shell min-h-[70vh] py-10"><p className="eyebrow">Service status</p><h1 className="serif mt-2 text-4xl">Health check</h1>{error ? <pre className="mt-6 whitespace-pre-wrap rounded border border-[#e4c5ba] bg-[#fff4f0] p-4 text-sm text-[var(--coral)]">{error.message}</pre> : Object.keys(grouped).length ? <div className="mt-6 grid gap-6 sm:grid-cols-2">{Object.entries(grouped).map(([kind, labels]) => <section key={kind} className="border-t border-[var(--line)] pt-3"><h2 className="serif text-xl capitalize">{kind}</h2><ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">{labels.map((label) => <li key={label}>{label}</li>)}</ul></section>)}</div> : <p className="mt-6 text-sm text-[var(--muted)]">No tags found.</p>}</div>;
}
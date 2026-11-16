"use server";

import { canonicalKey, distinctiveTokens, listingUrl, nameSimilarity } from "@/lib/normalize";
import { createClient } from "@/lib/supabase/server";
import type { SubjectKind } from "@/lib/types";

export type SubjectMatch = {
  id: string;
  display_name: string;
  address: string | null;
  source_url: string | null;
};

export async function searchSubjects(query: string, kind: SubjectKind): Promise<SubjectMatch[]> {
  const term = query.trim();
  if (term.length < 3) return [];

  const supabase = await createClient();
  const terms = [...new Set([term, ...distinctiveTokens(term).filter((token) => token.length >= 3)])];
  const results = await Promise.all(terms.map((part) => supabase
    .from("subjects")
    .select("id,display_name,address,source_url")
    .eq("kind", kind)
    .ilike("display_name", `%${part.replace(/[%_,]/g, " ")}%`)
    .limit(8)));
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`Could not search places: ${failed.error.message}`);
  return [...new Map(results.flatMap((result) => result.data ?? []).map((subject) => [subject.id, subject])).values()]
    .sort((a, b) => nameSimilarity(term, b.display_name) - nameSimilarity(term, a.display_name))
    .slice(0, 8);
}

export async function upsertSubject(input: {
  kind: SubjectKind;
  name: string;
  address: string;
  sourceUrl: string;
  phone: string;
}): Promise<{ subjectId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in before publishing your review." };
  const sourceUrl = listingUrl(input.sourceUrl);
  if (input.sourceUrl.trim() && !sourceUrl) return { error: "Could not save the place: enter a valid listing URL." };

  const { data, error } = await supabase.rpc("upsert_subject", {
    p_kind: input.kind,
    p_name: input.name.trim(),
    p_address: input.address.trim(),
    p_key: canonicalKey(input.name, input.address),
    p_source_url: sourceUrl,
    p_phone: input.phone.trim() || null,
  });
  if (error) return { error: `Could not save the place: ${error.message}` };
  if (!data) return { error: "Could not save the place: the database returned no subject id." };
  return { subjectId: data };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canonicalKey, normalizeAirbnbUrl, normalizeAddress } from "@/lib/normalize";
import { createClient } from "@/lib/supabase/server";
import type { SubjectKind } from "@/lib/types";

export type SelectedTag = { id: number; note: string };

export async function searchSubjects(query: string) {
  const supabase = await createClient();
  const term = query.trim();
  if (!term) return [];
  const pattern = `%${term.replace(/[%,]/g, " ")}%`;
  const [byName, byCity] = await Promise.all([
    supabase.from("subjects").select("*").ilike("display_name", pattern).limit(12),
    supabase.from("subjects").select("*").ilike("city", pattern).limit(12),
  ]);
  return [...new Map([...(byName.data ?? []), ...(byCity.data ?? [])].map((subject) => [subject.id, subject])).values()];
}

export async function identifySubject(input: { kind: SubjectKind; name: string; address: string; city: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in before starting a review." };

  const airbnbKey = normalizeAirbnbUrl(input.name);
  const kind: SubjectKind = airbnbKey ? "stay" : input.kind;
  const key = canonicalKey(kind, input.name, input.address);
  if (!key) return { error: kind === "stay" ? "Enter a valid Airbnb listing link." : "Add a name and address." };

  const { data: exact, error: lookupError } = await supabase.from("subjects").select("*").eq("kind", kind).eq("canonical_key", key).maybeSingle();
  if (lookupError) return { error: lookupError.message };
  if (exact) return { subject: exact, exact: true };

  if (kind !== "stay") {
    const { data: candidates } = await supabase.from("subjects").select("*").eq("kind", kind).ilike("display_name", `%${input.name.trim().replace(/[%_]/g, " ")}%`).limit(5);
    const close = candidates?.find((candidate) => normalizeAddress(candidate.display_name) === normalizeAddress(input.name) || (input.city && candidate.city?.toLowerCase() === input.city.toLowerCase()));
    if (close) return { candidate: close };
  }

  const sourceUrl = airbnbKey ? `https://${airbnbKey}` : null;
  const { data: created, error } = await supabase.from("subjects").insert({
    kind,
    canonical_key: key,
    display_name: airbnbKey ? `Airbnb stay ${airbnbKey.split("/").at(-1)}` : input.name.trim(),
    source_url: sourceUrl,
    address: input.address.trim() || null,
    city: input.city.trim() || null,
    created_by: user.id,
  }).select("*").single();
  if (error) return { error: error.message };
  return { subject: created, exact: true };
}

export async function getTags(kind: SubjectKind) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tags").select("*").eq("kind", kind).order("label");
  return { tags: data ?? [], error: error?.message ?? null };
}

export async function updateSubjectDetails(input: { subjectId: string; kind: SubjectKind; hostName: string; hostUsername: string; city: string; placeType: "whole" | "private" | "shared" | ""; priceTier: number | null }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to continue." };
  const details = input.kind === "stay"
    ? { host_name: input.hostName || null, host_username: input.hostUsername || null, city: input.city || null, place_type: input.placeType || null }
    : input.kind === "hotel"
      ? { city: input.city || null, price_tier: input.priceTier }
      : { city: input.city || null };
  const { error } = await supabase.from("subjects").update(details).eq("id", input.subjectId);
  return { error: error?.message ?? null };
}

export async function saveReview(input: {
  reviewId?: string;
  subjectId: string;
  rating: number;
  body: string;
  visitDate: string;
  stayStart: string;
  stayEnd: string;
  selectedTags: (SelectedTag | { label: string; note: string })[];
  kind: SubjectKind;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to publish your review." };
  if (!Number.isInteger(input.rating) || input.rating < 0 || input.rating > 5) return { error: "Choose a rating from 0 to 5." };
  if (input.rating === 0 && input.body.trim().length < 10) return { error: "A zero-star review needs at least 10 characters." };

  const resolvedTags: SelectedTag[] = [];
  for (const tag of input.selectedTags) {
    if ("id" in tag) { resolvedTags.push(tag); continue; }
    const slug = normalizeAddress(tag.label).replace(/\s+/g, "-");
    if (!slug) continue;
    const { data: existing } = await supabase.from("tags").select("id").eq("kind", input.kind).eq("slug", slug).maybeSingle();
    if (existing) { resolvedTags.push({ id: existing.id, note: tag.note }); continue; }
    const { data: createdTag, error: tagError } = await supabase.from("tags").insert({ kind: input.kind, label: tag.label.trim(), slug }).select("id").single();
    if (tagError) return { error: `Custom tags cannot be added with the current database policy: ${tagError.message}` };
    resolvedTags.push({ id: createdTag.id, note: tag.note });
  }

  const values = {
    subject_id: input.subjectId,
    user_id: user.id,
    rating: input.rating,
    body: input.body.trim() || null,
    visit_date: input.visitDate || null,
    stay_start: input.stayStart || null,
    stay_end: input.stayEnd || null,
    status: "published" as const,
    updated_at: new Date().toISOString(),
  };
  let reviewId = input.reviewId;
  if (reviewId) {
    const { error } = await supabase.from("reviews").update(values).eq("id", reviewId).eq("user_id", user.id);
    if (error) return { error: error.message };
    await supabase.from("review_tags").delete().eq("review_id", reviewId);
  } else {
    const { data, error } = await supabase.from("reviews").insert(values).select("id").single();
    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await supabase.from("reviews").select("id").eq("subject_id", input.subjectId).eq("user_id", user.id).maybeSingle();
        return { error: "You already reviewed this. Edit your review instead?", duplicateReviewId: existing?.id };
      }
      return { error: error.message };
    }
    reviewId = data.id;
  }

  if (resolvedTags.length && reviewId) {
    const { error } = await supabase.from("review_tags").insert(resolvedTags.map((tag) => ({ review_id: reviewId!, tag_id: tag.id, value: true, note: tag.note.trim() || null })));
    if (error) return { error: error.message };
  }
  revalidatePath(`/s/${input.subjectId}`);
  return { reviewId, subjectId: input.subjectId };
}

export async function attachMedia(reviewId: string, media: { storageKey: string; width: number; height: number; position: number }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to attach photos." };
  const { data: review } = await supabase.from("reviews").select("id").eq("id", reviewId).eq("user_id", user.id).maybeSingle();
  if (!review) return { error: "Review not found." };
  if (media.some((item) => !item.storageKey.startsWith(`${user.id}/${reviewId}/`))) return { error: "Invalid photo path." };
  const { error } = await supabase.from("media").insert(media.map((item) => ({ review_id: reviewId, kind: "photo" as const, storage_key: item.storageKey, width: item.width, height: item.height, status: "ready" as const, position: item.position })));
  return { error: error?.message ?? null };
}

export async function deleteReview(reviewId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { error: null };
}

export async function finishReview(subjectId: string) {
  revalidatePath(`/s/${subjectId}`);
  redirect(`/s/${subjectId}`);
}
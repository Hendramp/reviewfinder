"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listingUrl, normalizeAddress } from "@/lib/normalize";
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

export async function identifySubject(input: {
  kind: SubjectKind;
  name: string;
  address: string;
  sourceUrl: string;
  placeType: "whole" | "private" | "shared" | "";
  priceTier: number | null;
  createNew?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in before starting a review." };

  const name = input.name.trim();
  const address = input.address.trim();
  const sourceUrl = listingUrl(input.sourceUrl);
  const nameKey = normalizeAddress(name);
  const addressKey = normalizeAddress(address);
  if (!name || !address || !sourceUrl || !nameKey || !addressKey) return { error: "Enter a name, street address, and valid listing URL." };
  if (!["whole", "private", "shared"].includes(input.placeType) || (input.kind === "lease" && input.placeType === "shared")) return { error: "Choose a valid place type for this category." };
  if (input.priceTier === null || !Number.isInteger(input.priceTier) || input.priceTier < 1 || input.priceTier > 4) return { error: "Choose a price tier from 1 to 4." };

  const { data: exact, error: exactError } = await supabase.from("subjects").select("*")
    .eq("kind", input.kind).eq("name_key", nameKey).eq("address_key", addressKey).limit(5);
  if (exactError) return { error: exactError.message };
  const namePattern = `%${name.replace(/[%_,]/g, " ")}%`;
  const addressPattern = `%${address.replace(/[%_,]/g, " ")}%`;
  const { data: partial, error: partialError } = await supabase.from("subjects").select("*")
    .eq("kind", input.kind).ilike("display_name", namePattern).ilike("address", addressPattern).limit(10);
  if (partialError) return { error: partialError.message };
  const candidates = [...new Map([...(exact ?? []), ...(partial ?? [])].map((subject) => [subject.id, subject])).values()];
  if (candidates.length && !input.createNew) return { candidates };

  const { data: created, error } = await supabase.from("subjects").insert({
    kind: input.kind,
    display_name: name,
    source_url: sourceUrl,
    address,
    place_type: input.placeType || null,
    price_tier: input.priceTier,
    created_by: user.id,
  }).select("*").single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase.from("subjects").select("id,display_name,address")
        .eq("kind", input.kind).eq("name_key", nameKey).eq("address_key", addressKey).maybeSingle();
      return existing ? { duplicate: existing } : { error: "This place already exists, but its page could not be found. Try searching for it by name." };
    }
    return { error: error.message };
  }
  return { subject: created };
}

export async function getTags(kind: SubjectKind) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tags").select("*").eq("kind", kind).order("label");
  return { tags: data ?? [], error: error?.message ?? null };
}

export async function updateSubjectDetails(input: { subjectId: string; kind: SubjectKind; hostName: string; hostUsername: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to continue." };
  if (input.kind !== "stay") return { error: null };
  const details = input.kind === "stay"
    ? { host_name: input.hostName || null, host_username: input.hostUsername || null }
    : {};
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
  leaseMonths: number | null;
  selectedTags: (SelectedTag | { label: string; note: string })[];
  kind: SubjectKind;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to publish your review." };
  if (!Number.isInteger(input.rating) || input.rating < 0 || input.rating > 5) return { error: "Choose a rating from 0 to 5." };
  if (input.rating === 0 && input.body.trim().length < 10) return { error: "A zero-star review needs at least 10 characters." };
  if (input.kind === "lease" && (!Number.isInteger(input.leaseMonths) || input.leaseMonths! < 1 || input.leaseMonths! > 120)) return { error: "Enter a lease length from 1 to 120 months." };

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
    lease_months: input.kind === "lease" ? input.leaseMonths : null,
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
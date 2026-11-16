"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listingUrl, normalizeAddress } from "@/lib/normalize";
import { createClient } from "@/lib/supabase/server";
import { isUsernameUniqueViolation, USERNAME_PATTERN } from "@/lib/username";
import type { ReportReason, SubjectKind } from "@/lib/types";

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

export async function getTags(kind: SubjectKind) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tags").select("*").eq("kind", kind).order("label");
  return { tags: data ?? [], error: error?.message ?? null };
}

export async function saveProfileUsername(username: string) {
  const normalizedUsername = username.trim();
  if (!USERNAME_PATTERN.test(normalizedUsername)) return { error: "Use 3–24 lowercase letters, numbers, or underscores." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to choose a username." };

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("id").eq("id", user.id).maybeSingle();
  if (profileError) return { error: "Could not save your username. Please try again." };
  const profileValues = { username: normalizedUsername, updated_at: new Date().toISOString() };
  const { data, error } = profile
    ? await supabase.from("profiles").update(profileValues).eq("id", user.id).select("id,username").maybeSingle()
    : await supabase.from("profiles").insert({ id: user.id, ...profileValues, display_name: normalizedUsername }).select("id,username").maybeSingle();
  if (error) {
    if (isUsernameUniqueViolation(error)) return { error: "That username was just taken — try another." };
    return { error: "Could not save your username. Please try again." };
  }
  if (!data) return { error: "Could not save your username. Please try again." };

  revalidatePath("/profile");
  return { username: data.username };
}

export async function submitReviewReport(input: { reviewId: string; reason: ReportReason; note: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to report this review." };
  if (!["spam", "harassment", "not_a_real_review", "wrong_place", "other"].includes(input.reason)) {
    return { error: "Choose a valid report reason." };
  }
  if (input.note.trim().length > 1000) return { error: "The note must be 1,000 characters or fewer." };

  const { error } = await supabase.from("reports").insert({
    review_id: input.reviewId,
    reporter_id: user.id,
    reason: input.reason,
    note: input.note.trim() || null,
    status: "open",
  });
  if (error) return { error: "Could not submit your report. Please try again." };
  revalidatePath("/admin");
  return { error: null };
}

export async function updateSubjectDetails(input: { subjectId: string; kind: SubjectKind; hostName: string; hostUsername: string; phone: string; sourceUrl: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to continue." };
  const sourceUrl = listingUrl(input.sourceUrl);
  if (input.sourceUrl.trim() && !sourceUrl) return { error: "Enter a valid listing URL." };
  const details = {
    ...(input.kind === "stay" ? { host_name: input.hostName || null, host_username: input.hostUsername || null } : {}),
    phone: input.phone || null,
    source_url: sourceUrl,
  };
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
  stayNights: number | null;
  nightlyCost: number | null;
  monthlyCost: number | null;
  leaseMonths: number | null;
  kind: SubjectKind;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to publish your review." };
  if (!Number.isInteger(input.rating) || input.rating < 0 || input.rating > 5) return { error: "Choose a rating from 0 to 5." };
  if (input.kind !== "stay" && input.rating === 0 && input.body.trim().length < 10) return { error: "A zero-star review needs at least 10 characters." };
  if (input.kind === "lease" && input.leaseMonths !== null && (!Number.isInteger(input.leaseMonths) || input.leaseMonths < 1 || input.leaseMonths > 120)) return { error: "Enter a lease length from 1 to 120 months." };
  if (input.kind === "hotel" && input.stayNights !== null && (!Number.isInteger(input.stayNights) || input.stayNights < 1)) return { error: "Enter a stay length of at least one night." };
  if (input.kind === "hotel" && input.nightlyCost !== null && (!Number.isFinite(input.nightlyCost) || input.nightlyCost < 0)) return { error: "Enter a valid nightly amount of zero or more." };
  if (input.kind === "lease" && input.monthlyCost !== null && (!Number.isFinite(input.monthlyCost) || input.monthlyCost < 0)) return { error: "Enter a valid monthly amount of zero or more." };

  const values = {
    subject_id: input.subjectId,
    user_id: user.id,
    rating: input.rating,
    body: input.body.trim() || null,
    visit_date: input.visitDate || null,
    stay_start: input.stayStart || null,
    stay_end: input.stayEnd || null,
    ...(input.kind === "lease"
      ? { monthly_cost: input.monthlyCost, lease_months: input.leaseMonths }
      : input.kind === "hotel"
        ? { nightly_cost: input.nightlyCost, stay_nights: input.stayNights }
        : {}),
    status: "published" as const,
    updated_at: new Date().toISOString(),
  };
  let reviewId = input.reviewId;
  if (reviewId) {
    const { error } = await supabase.from("reviews").update(values).eq("id", reviewId).eq("user_id", user.id);
    if (error) return { error: error.message };
    const { error: tagDeleteError } = await supabase.from("review_tags").delete().eq("review_id", reviewId);
    if (tagDeleteError) return { error: `Could not clear previous review tags: ${tagDeleteError.message}` };
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

  revalidatePath(`/s/${input.subjectId}`);
  return { reviewId, subjectId: input.subjectId };
}

export async function saveReviewTags(input: {
  reviewId: string;
  kind: SubjectKind;
  selectedTags: (SelectedTag | { label: string; note: string })[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to save review tags." };
  const { data: review } = await supabase.from("reviews").select("id").eq("id", input.reviewId).eq("user_id", user.id).maybeSingle();
  if (!review) return { error: "Review not found while saving tags." };

  const resolvedTags: SelectedTag[] = [];
  for (const tag of input.selectedTags) {
    if ("id" in tag) { resolvedTags.push(tag); continue; }
    const slug = normalizeAddress(tag.label).replace(/\s+/g, "-");
    if (!slug) continue;
    const { data: existing, error: lookupError } = await supabase.from("tags").select("id").eq("kind", input.kind).eq("slug", slug).maybeSingle();
    if (lookupError) return { error: `Could not resolve custom review tags: ${lookupError.message}` };
    if (existing) { resolvedTags.push({ id: existing.id, note: tag.note }); continue; }
    const { data: createdTag, error: tagError } = await supabase.from("tags").insert({ kind: input.kind, label: tag.label.trim(), slug }).select("id").single();
    if (tagError) return { error: `Could not create custom review tags: ${tagError.message}` };
    resolvedTags.push({ id: createdTag.id, note: tag.note });
  }

  const { error: deleteError } = await supabase.from("review_tags").delete().eq("review_id", input.reviewId);
  if (deleteError) return { error: `Could not replace review tags: ${deleteError.message}` };
  if (!resolvedTags.length) return { error: null };
  const { error } = await supabase.from("review_tags").insert(resolvedTags.map((tag) => ({
    review_id: input.reviewId,
    tag_id: tag.id,
    value: true,
    note: tag.note.trim() || null,
  })));
  return { error: error ? `Could not save review tags: ${error.message}` : null };
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
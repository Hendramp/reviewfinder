"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getAdminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in with an admin account to continue." } as const;
  const { data: profile, error } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (error) return { error: `Could not verify admin access: ${error.message}` } as const;
  if (!profile?.is_admin) return { error: "You do not have permission to perform this action." } as const;
  return { supabase, user } as const;
}

async function deleteReviewContent(supabase: Awaited<ReturnType<typeof createClient>>, reviewId: string) {
  const { data: photos, error: photoQueryError } = await supabase.from("media")
    .select("storage_key,thumb_key").eq("review_id", reviewId).eq("kind", "photo");
  if (photoQueryError) return `Could not load review photos: ${photoQueryError.message}`;

  const keys = [...new Set((photos ?? []).flatMap((photo) => [photo.storage_key, photo.thumb_key].filter((key): key is string => Boolean(key))))];
  if (keys.length) {
    const { error } = await supabase.storage.from("review-photos").remove(keys);
    if (error) return `Could not delete review photos from storage: ${error.message}`;
  }

  const { error: mediaError } = await supabase.from("media").delete().eq("review_id", reviewId).eq("kind", "photo");
  if (mediaError) return `Could not delete photo records: ${mediaError.message}`;

  const { data: deletedReview, error: reviewError } = await supabase.from("reviews").delete().eq("id", reviewId).select("id").maybeSingle();
  if (reviewError) return `Could not delete review: ${reviewError.message}`;
  if (!deletedReview) return "The review was not deleted; check the admin RLS policies.";
  return null;
}

export async function resolveReport(reportId: string, action: "delete" | "dismiss") {
  const access = await getAdminClient();
  if (access.error) return access;
  const { supabase, user } = access;
  const { data: report, error: reportError } = await supabase.from("reports")
    .select("id,review_id,photo_id").eq("id", reportId).eq("status", "open").maybeSingle();
  if (reportError) return { error: `Could not load report: ${reportError.message}` };
  if (!report) return { error: "This open report was not found; check the admin RLS policies." };

  if (action === "delete") {
    let reviewId = report.review_id;
    if (!reviewId && report.photo_id) {
      const { data: photo, error } = await supabase.from("media").select("review_id").eq("id", report.photo_id).maybeSingle();
      if (error) return { error: `Could not load the reported photo: ${error.message}` };
      reviewId = photo?.review_id ?? null;
    }
    if (!reviewId) return { error: "This report is not linked to review content." };
    const deleteError = await deleteReviewContent(supabase, reviewId);
    if (deleteError) return { error: deleteError };
  }

  const { data: updatedReport, error } = await supabase.from("reports").update({
    status: action === "delete" ? "resolved" : "dismissed",
    resolved_at: new Date().toISOString(),
    resolved_by: user.id,
  }).eq("id", reportId).eq("status", "open").select("id").maybeSingle();
  if (error) return { error: `Could not update report: ${error.message}` };
  if (!updatedReport) return { error: "The report was not updated; check the admin RLS policies." };

  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}

export async function deleteReview(reviewId: string) {
  const access = await getAdminClient();
  if (access.error) return access;
  const error = await deleteReviewContent(access.supabase, reviewId);
  if (error) return { error };
  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}
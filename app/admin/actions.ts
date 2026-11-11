"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/app/admin/service";

async function authorizeAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !process.env.ADMIN_EMAIL || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL.toLowerCase()) return false;
  return true;
}

export async function resolveReport(reportId: string, action: "remove" | "dismiss") {
  if (!await authorizeAdmin()) return { error: "Not found." };
  const admin = createAdminClient();
  if (action === "remove") {
    const { data: report, error: readError } = await admin.from("reports").select("review_id").eq("id", reportId).single();
    if (readError || !report?.review_id) return { error: readError?.message ?? "Report has no review." };
    const { error: reviewError } = await admin.from("reviews").update({ status: "removed" }).eq("id", report.review_id);
    if (reviewError) return { error: reviewError.message };
    const { error } = await admin.from("reports").update({ status: "actioned" }).eq("id", reportId);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from("reports").update({ status: "dismissed" }).eq("id", reportId);
    if (error) return { error: error.message };
  }
  revalidatePath("/admin");
  return { error: null };
}
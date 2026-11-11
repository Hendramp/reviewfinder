import { notFound, redirect } from "next/navigation";
import WriteForm from "@/app/write/WriteForm";
import { createClient } from "@/lib/supabase/server";
import type { Media } from "@/lib/types";

type Params = Promise<{ input?: string; subject?: string; review?: string }>;

export default async function WritePage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const query = new URLSearchParams();
    for (const key of ["input", "subject", "review"] as const) if (params[key]) query.set(key, params[key]!);
    const returnPath = `/write${query.size ? `?${query.toString()}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  }
  let initialSubject;
  let initialReview;
  let initialReviewTags: { id: number; label: string; note: string | null }[] = [];
  let initialMedia: Media[] = [];
  if (params.review) {
    const { data: review } = await supabase.from("reviews").select("*").eq("id", params.review).eq("user_id", user.id).maybeSingle();
    if (!review) notFound();
    initialReview = review;
    const [{ data: subject }, { data: reviewTags }, { data: media }] = await Promise.all([
      supabase.from("subjects").select("*").eq("id", review.subject_id).maybeSingle(),
      supabase.from("review_tags").select("*").eq("review_id", review.id).eq("value", true),
      supabase.from("media").select("*").eq("review_id", review.id).eq("kind", "photo").eq("status", "ready").order("position"),
    ]);
    if (!subject) notFound();
    initialSubject = subject;
    initialMedia = media ?? [];
    const tagIds = (reviewTags ?? []).map((tag) => tag.tag_id);
    if (tagIds.length) {
      const { data: tags } = await supabase.from("tags").select("id,label").in("id", tagIds);
      const labels = new Map((tags ?? []).map((tag) => [tag.id, tag.label]));
      initialReviewTags = (reviewTags ?? []).map((tag) => ({ id: tag.tag_id, label: labels.get(tag.tag_id) ?? "Tag", note: tag.note }));
    }
  } else if (params.subject) {
    const { data } = await supabase.from("subjects").select("*").eq("id", params.subject).maybeSingle();
    if (!data) notFound();
    initialSubject = data;
  }
  return <div className="page-shell min-h-[72vh] py-10"><WriteForm input={params.input} initialSubject={initialSubject} initialReview={initialReview} initialReviewTags={initialReviewTags} initialMedia={initialMedia} /></div>;
}
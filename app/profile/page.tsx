import Link from "next/link";
import { redirect } from "next/navigation";
import DeleteReviewButton from "@/app/profile/DeleteReviewButton";
import StarRating from "@/components/StarRating";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: reviews } = await supabase.from("reviews").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  const ids = [...new Set((reviews ?? []).map((review) => review.subject_id))];
  const { data: subjects } = ids.length ? await supabase.from("subjects").select("*").in("id", ids) : { data: [] };
  const subjectMap = new Map((subjects ?? []).map((subject) => [subject.id, subject]));
  return <div className="page-shell min-h-[70vh] py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Your contributions</p><h1 className="serif mt-2 text-4xl">Profile</h1><p className="mt-2 text-sm text-[var(--muted)]">{user.email}</p></div><Link href="/write" className="button">Write a review</Link></div>
    <div className="mt-7">{(reviews ?? []).length ? (reviews ?? []).map((review) => <article key={review.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] py-5"><div><Link href={`/s/${review.subject_id}`} className="serif text-xl no-underline">{subjectMap.get(review.subject_id)?.display_name ?? "Place"}</Link><div className="mt-2 flex items-center gap-3"><StarRating value={review.rating} /><span className="text-xs text-[var(--muted)]">{formatDate(review.visit_date ?? review.created_at)}</span><span className="text-xs text-[var(--muted)]">{review.status}</span></div></div><div className="flex gap-4"><Link className="text-sm text-[var(--green)] underline" href={`/write?review=${review.id}`}>Edit</Link><DeleteReviewButton reviewId={review.id} /></div></article>) : <div className="empty-state border-x-0 border-b-0 border-t mt-4"><p className="eyebrow">A good story starts small</p><p className="serif mt-1 text-2xl">Your first review is still waiting to be written.</p><p className="mt-2 text-sm text-[var(--muted)]">Start with one place you still think about.</p><Link className="button mt-4" href="/write">Write your first review</Link></div>}</div>
  </div>;
}
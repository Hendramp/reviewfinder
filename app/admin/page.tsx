import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/app/admin/service";
import ReportActions from "@/app/admin/ReportActions";
import type { Media, Review, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user || !process.env.ADMIN_EMAIL || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL.toLowerCase()) notFound();

  const admin = createAdminClient();
  const { data: reports, error } = await admin.from("reports").select("*").eq("status", "open").order("created_at", { ascending: false });
  const reviewIds = [...new Set((reports ?? []).map((report) => report.review_id).filter(Boolean))] as string[];
  const reporterIds = [...new Set((reports ?? []).map((report) => report.reporter_id))];
  const [{ data: reviews }, { data: media }] = reviewIds.length ? await Promise.all([
    admin.from("reviews").select("*").in("id", reviewIds),
    admin.from("media").select("*").in("review_id", reviewIds).eq("kind", "photo").eq("status", "ready").order("position"),
  ]) : [{ data: [] as Review[] }, { data: [] as Media[] }];
  const subjectIds = [...new Set((reviews ?? []).map((review) => review.subject_id))];
  const { data: subjects } = subjectIds.length ? await admin.from("subjects").select("*").in("id", subjectIds) : { data: [] as Subject[] };
  const userResults = await Promise.all(reporterIds.map((id) => admin.auth.admin.getUserById(id)));
  const reporterEmails = new Map(reporterIds.map((id, index) => [id, userResults[index].data.user?.email ?? id]));
  const reviewsById = new Map((reviews ?? []).map((review) => [review.id, review]));
  const subjectsById = new Map((subjects ?? []).map((subject) => [subject.id, subject]));
  const mediaByReview = new Map<string, Media[]>();
  for (const item of media ?? []) mediaByReview.set(item.review_id, [...(mediaByReview.get(item.review_id) ?? []), item]);
  const photoUrls = new Map<string, string>();
  for (const item of media ?? []) {
    const { data } = await admin.storage.from("review-photos").createSignedUrl(item.thumb_key ?? item.storage_key, 3600);
    if (data?.signedUrl) photoUrls.set(item.id, data.signedUrl);
  }

  return <div className="page-shell min-h-[70vh] py-10"><p className="eyebrow">Admin</p><h1 className="serif mt-2 text-4xl">Open reports</h1>
    {error && <p role="alert" className="mt-5 text-sm text-[var(--coral)]">{error.message}</p>}
    {reports?.length ? reports.map((report) => {
      const review = report.review_id ? reviewsById.get(report.review_id) : undefined;
      const subject = review ? subjectsById.get(review.subject_id) : undefined;
      return <article key={report.id} className="border-b border-[var(--line)] py-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{report.reason.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[var(--muted)]">Reported by {reporterEmails.get(report.reporter_id)} · {new Date(report.created_at).toLocaleString()}</p></div><ReportActions reportId={report.id} /></div>
        {report.note && <p className="mt-3 text-sm">Report note: {report.note}</p>}
        {review && <><p className="mt-4 whitespace-pre-wrap text-sm leading-6">{review.body || "No written review text."}</p>{subject && <Link className="mt-2 inline-block text-sm text-[var(--green)] underline" href={`/s/${subject.id}`}>{subject.display_name}</Link>}<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{(mediaByReview.get(review.id) ?? []).map((photo) => photoUrls.get(photo.id) && <img key={photo.id} src={photoUrls.get(photo.id)} alt="Reported review photo" className="aspect-[4/3] w-full rounded-sm object-cover" />)}</div></>}
      </article>;
    }) : !error && <p className="border-t border-[var(--line)] py-10 text-sm text-[var(--muted)]">No open reports.</p>}
  </div>;
}
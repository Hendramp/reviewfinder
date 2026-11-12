import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportActions, { RecentReviewActions } from "@/app/admin/ReportActions";
import type { Review } from "@/lib/types";

export const dynamic = "force-dynamic";

function AdminQueryError({ message }: { message: string }) {
  return <div className="page-shell py-12"><p className="eyebrow">Admin</p><h1 className="serif mt-2 text-4xl">Moderation</h1><p role="alert" className="mt-6 rounded-lg border border-[var(--danger)]/30 bg-[var(--surface)] p-4 text-sm text-[var(--danger)]">Admin data could not be loaded. Check the admin RLS policies. {message}</p></div>;
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("is_admin").eq("id", user.id).maybeSingle();
  if (profileError) return <AdminQueryError message={profileError.message} />;
  if (!profile?.is_admin) redirect("/");

  const [reportsResult, openReportsCount, reviewCount, subjectCount, recentReviewsResult] = await Promise.all([
    supabase.from("reports").select("*").eq("status", "open").order("created_at", { ascending: false }),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("subjects").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  const initialError = reportsResult.error ?? openReportsCount.error ?? reviewCount.error ?? subjectCount.error ?? recentReviewsResult.error;
  if (initialError) return <AdminQueryError message={initialError.message} />;
  if (!reportsResult.data || !recentReviewsResult.data) {
    return <AdminQueryError message="The reports or recent-reviews query returned no result data." />;
  }
  if (openReportsCount.count === null || reviewCount.count === null || subjectCount.count === null) {
    return <AdminQueryError message="One or more row counts were unavailable." />;
  }
  if (openReportsCount.count > 0 && reportsResult.data.length === 0) {
    return <AdminQueryError message="The open-report count is nonzero, but the reports query returned no rows." />;
  }
  if (reviewCount.count > 0 && recentReviewsResult.data.length === 0) {
    return <AdminQueryError message="The review count is nonzero, but the recent-reviews query returned no rows." />;
  }

  const reports = reportsResult.data;
  const recentReviews = recentReviewsResult.data;
  const photoIds = [...new Set(reports.map((report) => report.photo_id).filter((id): id is string => Boolean(id)))];
  const reporterIds = [...new Set(reports.map((report) => report.reporter_id))];
  const reportPhotosResult = photoIds.length
    ? await supabase.from("media").select("id,review_id").in("id", photoIds)
    : null;
  if (reportPhotosResult?.error) return <AdminQueryError message={reportPhotosResult.error.message} />;
  if (reportPhotosResult && (!reportPhotosResult.data || reportPhotosResult.data.length !== photoIds.length)) {
    return <AdminQueryError message="One or more reported photos are not visible through the current RLS policies." />;
  }
  const reviewForPhoto = new Map((reportPhotosResult?.data ?? []).map((photo) => [photo.id, photo.review_id]));
  const reportReviewIds = [...new Set(reports.map((report) => report.review_id ?? (report.photo_id ? reviewForPhoto.get(report.photo_id) : null)).filter((id): id is string => Boolean(id)))];
  const knownReviewIds = new Set(recentReviews.map((review) => review.id));
  const additionalReviewIds = reportReviewIds.filter((id) => !knownReviewIds.has(id));
  const additionalReviewsResult = additionalReviewIds.length
    ? await supabase.from("reviews").select("*").in("id", additionalReviewIds)
    : null;
  if (additionalReviewsResult?.error) return <AdminQueryError message={additionalReviewsResult.error.message} />;
  if (additionalReviewsResult && (!additionalReviewsResult.data || additionalReviewsResult.data.length !== additionalReviewIds.length)) {
    return <AdminQueryError message="One or more reported reviews are not visible through the current RLS policies." />;
  }

  const allReviews: Review[] = [...recentReviews, ...(additionalReviewsResult?.data ?? [])];
  const reviewById = new Map(allReviews.map((review) => [review.id, review]));
  const subjectIds = [...new Set(allReviews.map((review) => review.subject_id))];
  const [subjectsResult, reportersResult] = await Promise.all([
    subjectIds.length ? supabase.from("subjects").select("id,display_name").in("id", subjectIds) : null,
    reporterIds.length ? supabase.from("profiles").select("id,username,display_name").in("id", reporterIds) : null,
  ]);
  if (subjectsResult?.error) return <AdminQueryError message={subjectsResult.error.message} />;
  if (reportersResult?.error) return <AdminQueryError message={reportersResult.error.message} />;
  if (subjectsResult && (!subjectsResult.data || subjectsResult.data.length !== subjectIds.length)) {
    return <AdminQueryError message="One or more subjects are not visible through the current RLS policies." />;
  }
  if (reportersResult && (!reportersResult.data || reportersResult.data.length !== reporterIds.length)) {
    return <AdminQueryError message="One or more reporters are not visible through the current RLS policies." />;
  }

  const subjectById = new Map((subjectsResult?.data ?? []).map((subject) => [subject.id, subject]));
  const reporterById = new Map((reportersResult?.data ?? []).map((reporter) => [reporter.id, reporter]));
  const noContentVisible = reviewCount.count === 0 && subjectCount.count === 0;

  return <div className="page-shell min-h-[70vh] py-10">
    <p className="eyebrow">Admin</p>
    <h1 className="serif mt-2 text-4xl">Moderation</h1>
    <section aria-label="Site counts" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[["Open reports", openReportsCount.count], ["Total reviews", reviewCount.count], ["Total subjects", subjectCount.count]].map(([label, count]) =>
        <div key={label} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"><p className="text-sm text-[var(--muted)]">{label}</p><p className="serif mt-1 text-3xl">{count}</p></div>)}
    </section>
    {noContentVisible && <p role="alert" className="mt-5 rounded-lg border border-[var(--danger)]/30 bg-[var(--surface)] p-4 text-sm text-[var(--danger)]">No reviews or subjects are visible to your admin account. If content exists, check the reviews and subjects RLS policies.</p>}

    <section className="mt-10">
      <h2 className="serif text-2xl">Reports queue</h2>
      {reports.length ? reports.map((report) => {
        const reviewId = report.review_id ?? (report.photo_id ? reviewForPhoto.get(report.photo_id) : undefined);
        const review = reviewId ? reviewById.get(reviewId) : undefined;
        const subject = review ? subjectById.get(review.subject_id) : undefined;
        const reporter = reporterById.get(report.reporter_id);
        const reporterName = reporter?.display_name || (reporter?.username ? `@${reporter.username}` : `User ${report.reporter_id.slice(0, 8)}`);
        const reviewName = subject?.display_name ?? "the reported review";
        const reviewHref = review && subject ? `/s/${subject.id}#review-${review.id}` : review ? `/admin#recent-review-${review.id}` : null;
        return <article key={report.id} className="border-b border-[var(--line)] py-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="eyebrow">{report.reason.replaceAll("_", " ")}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Reported by {reporterName} · {new Date(report.created_at).toLocaleString()}</p>
            </div>
            <ReportActions reportId={report.id} reviewName={reviewName} />
          </div>
          {report.note && <p className="mt-3 text-sm"><span className="font-semibold">Note:</span> {report.note}</p>}
          {review && <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
            {reviewHref && <Link className="text-sm font-semibold text-[var(--accent)] underline underline-offset-2" href={reviewHref}>{subject?.display_name ?? "View reported review"}</Link>}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{review.body || "No written review text."}</p>
          </div>}
          {!review && <p className="mt-4 text-sm text-[var(--muted)]">The reported review is not visible. Check its RLS policy or whether it has already been deleted.</p>}
        </article>;
      }) : <p className="border-t border-[var(--line)] py-8 text-sm text-[var(--muted)]">No open reports are visible. If an open report exists, check the reports RLS policy.</p>}
    </section>

    <section id="recent-reviews" className="mt-12">
      <h2 className="serif text-2xl">Recent reviews</h2>
      <div className="mt-3">
        {recentReviews.length ? recentReviews.map((review) => {
          const subject = subjectById.get(review.subject_id);
          const reviewName = subject?.display_name ?? "an unnamed place";
          return <article id={`recent-review-${review.id}`} key={review.id} className="flex flex-col justify-between gap-4 border-b border-[var(--line)] py-5 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{reviewName} <span className="font-normal text-[var(--muted)]">· {review.rating} stars · {new Date(review.created_at).toLocaleDateString()}</span></p>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-[var(--muted)]">{review.body || "No written review text."}</p>
              {subject && <Link className="mt-1 inline-block min-h-11 content-center text-sm text-[var(--accent)] underline underline-offset-2" href={`/s/${subject.id}#review-${review.id}`}>View review</Link>}
            </div>
            <RecentReviewActions reviewId={review.id} reviewName={reviewName} />
          </article>;
        }) : <p className="border-t border-[var(--line)] py-8 text-sm text-[var(--muted)]">No reviews are visible. If reviews exist, check the reviews RLS policy.</p>}
      </div>
    </section>
  </div>;
}

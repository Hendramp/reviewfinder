"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReview, resolveReport } from "@/app/admin/actions";

export default function ReportActions({ reportId, reviewName }: { reportId: string; reviewName: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: "delete" | "dismiss") {
    if (action === "delete" && !window.confirm(`Delete the review for "${reviewName}" and all of its photos?`)) return;
    startTransition(async () => {
      const result = await resolveReport(reportId, action);
      if (result.error) setMessage(result.error);
      else router.refresh();
    });
  }

  return <div className="flex flex-wrap items-center gap-2">
    <button className="button button-danger" disabled={pending} onClick={() => run("delete")}>Delete content</button>
    <button className="button button-secondary" disabled={pending} onClick={() => run("dismiss")}>Dismiss</button>
    {message && <span role="alert" className="text-xs text-[var(--danger)]">{message}</span>}
  </div>;
}

export function RecentReviewActions({ reviewId, reviewName }: { reviewId: string; reviewName: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    if (!window.confirm(`Delete the review for "${reviewName}" and all of its photos?`)) return;
    startTransition(async () => {
      const result = await deleteReview(reviewId);
      if (result.error) setMessage(result.error);
      else router.refresh();
    });
  }

  return <div className="flex items-center gap-3">
    <button className="button button-danger" disabled={pending} onClick={remove}>Delete</button>
    {message && <span role="alert" className="text-xs text-[var(--danger)]">{message}</span>}
  </div>;
}

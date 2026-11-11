"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReview } from "@/lib/actions";

export default function DeleteReviewButton({ reviewId }: { reviewId: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <span><button type="button" className="text-sm text-[var(--coral)] underline" disabled={pending} onClick={() => { if (!window.confirm("Delete this review permanently?")) return; startTransition(async () => { const result = await deleteReview(reviewId); if (result.error) setMessage(result.error); else router.refresh(); }); }}>{pending ? "Deleting…" : "Delete"}</button>{message && <span className="ml-2 text-xs">{message}</span>}</span>;
}
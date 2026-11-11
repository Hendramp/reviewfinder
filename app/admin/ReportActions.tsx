"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveReport } from "@/app/admin/actions";

export default function ReportActions({ reportId }: { reportId: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function run(action: "remove" | "dismiss") {
    startTransition(async () => { const result = await resolveReport(reportId, action); if (result.error) setMessage(result.error); else router.refresh(); });
  }
  return <div className="flex flex-wrap items-center gap-2"><button className="button button-danger" disabled={pending} onClick={() => run("remove")}>Remove review</button><button className="button button-secondary" disabled={pending} onClick={() => run("dismiss")}>Dismiss</button>{message && <span role="alert" className="text-xs text-[var(--coral)]">{message}</span>}</div>;
}
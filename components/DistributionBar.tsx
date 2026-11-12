import type { SubjectStats } from "@/lib/types";

export default function DistributionBar({ stats }: { stats: SubjectStats }) {
  const counts = [stats.zeros, stats.ones, stats.twos, stats.threes, stats.fours, stats.fives];
  const colors = ["var(--danger)", "color-mix(in srgb, var(--accent) 35%, var(--surface))", "color-mix(in srgb, var(--accent) 55%, var(--surface))", "color-mix(in srgb, var(--accent) 75%, var(--surface))", "color-mix(in srgb, var(--success) 70%, var(--surface))", "var(--success)"];
  return <div>
    <div className="flex h-3 overflow-hidden rounded-sm bg-[var(--border)]" role="img" aria-label={`Rating distribution: ${counts.map((count, index) => `${index} stars ${count}`).join(", ")}`}>
      {counts.map((count, index) => count > 0 && <span key={index} style={{ width: `${(count / Math.max(stats.review_count, 1)) * 100}%`, backgroundColor: colors[index] }} />)}
    </div>
    <div className="mt-2 grid grid-cols-6 text-center text-xs text-[var(--muted)]">{counts.map((count, index) => <span key={index}>{index} <b className="font-medium text-[var(--ink)]">{count}</b></span>)}</div>
  </div>;
}
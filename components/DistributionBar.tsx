import type { SubjectStats } from "@/lib/types";

export default function DistributionBar({ stats }: { stats: SubjectStats }) {
  const counts = [stats.zeros, stats.ones, stats.twos, stats.threes, stats.fours, stats.fives];
  const colors = ["#c65e43", "#dc8b56", "#d8b963", "#9aa36b", "#5c8b68", "#245c45"];
  return <div>
    <div className="flex h-3 overflow-hidden rounded-sm bg-[#e8e8df]" role="img" aria-label={`Rating distribution: ${counts.map((count, index) => `${index} stars ${count}`).join(", ")}`}>
      {counts.map((count, index) => count > 0 && <span key={index} style={{ width: `${(count / Math.max(stats.review_count, 1)) * 100}%`, backgroundColor: colors[index] }} />)}
    </div>
    <div className="mt-2 grid grid-cols-6 text-center text-xs text-[var(--muted)]">{counts.map((count, index) => <span key={index}>{index} <b className="font-medium text-[var(--ink)]">{count}</b></span>)}</div>
  </div>;
}
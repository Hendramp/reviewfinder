import Link from "next/link";
import type { SubjectKind } from "@/lib/types";

const categories: { label: string; value: SubjectKind; query: string }[] = [
  { label: "Stays", value: "stay", query: "stays" },
  { label: "Hotels", value: "hotel", query: "hotels" },
  { label: "Leases", value: "lease", query: "leases" },
];

export default function CategoryTabs({ active }: { active: SubjectKind }) {
  return <nav aria-label="Categories" className="flex gap-5 border-b border-[var(--line)] text-sm">
    {categories.map((category) => <Link key={category.value} aria-current={active === category.value ? "page" : undefined} href={`/browse?category=${category.query}`} className={`min-h-11 shrink-0 border-b-2 pb-3 no-underline ${active === category.value ? "border-[var(--accent)] font-semibold text-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}>{category.label}</Link>)}
  </nav>;
}

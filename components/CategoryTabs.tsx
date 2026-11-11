import Link from "next/link";
import type { SubjectKind } from "@/lib/types";

const categories: { label: string; value: SubjectKind | "all" }[] = [
  { label: "All", value: "all" }, { label: "Stays", value: "stay" }, { label: "Hotels", value: "hotel" }, { label: "Restaurants", value: "restaurant" }, { label: "Bars", value: "bar" },
];

export default function CategoryTabs({ active, base = "/browse" }: { active: SubjectKind | "all"; base?: string }) {
  return <nav aria-label="Categories" className="flex gap-5 overflow-x-auto border-b border-[var(--line)] text-sm">
    {categories.map((category) => <Link key={category.value} aria-current={active === category.value ? "page" : undefined} href={category.value === "all" ? base : `${base}${base.includes("?") ? "&" : "?"}kind=${category.value}`} className={`shrink-0 border-b-2 pb-3 no-underline ${active === category.value ? "border-[var(--coral)] font-semibold text-[var(--coral)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}>{category.label}</Link>)}
  </nav>;
}
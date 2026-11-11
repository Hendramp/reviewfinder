import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "ReviewFinder — the details that matter",
  description: "Honest reviews for stays, restaurants, bars, and hotels.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Nav /><main>{children}</main><footer className="page-shell border-t border-[var(--line)] py-7 text-xs text-[var(--muted)]">Independent reviews, grounded in real visits.</footer></body></html>;
}
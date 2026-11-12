import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: { default: "Unfilteredpillowtalk — real reviews with photo proof", template: "%s | Unfilteredpillowtalk" },
  description: "Real reviews with photo proof for stays, hotels, and leases.",
  applicationName: "Unfilteredpillowtalk",
  keywords: ["Unfilteredpillowtalk", "stays", "hotels", "leases", "real reviews", "photo proof"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Nav /><main>{children}</main><footer className="page-shell border-t border-[var(--line)] py-7 text-xs text-[var(--muted)]">Independent reviews, grounded in real visits.</footer></body></html>;
}
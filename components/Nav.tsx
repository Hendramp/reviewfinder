import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function Nav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profileHref = user ? "/profile" : "/login";
  return <>
    <header className="border-b border-[var(--line)] bg-[var(--paper)]">
      <div className="nav-container page-shell flex min-h-16 items-center justify-between gap-5">
        <Link href="/" className="flex min-h-11 items-center gap-2 font-semibold tracking-tight no-underline"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-sm font-bold text-white">U</span><span className="serif text-base sm:text-lg">Unfilteredpillowtalk</span></Link>
        <Link href="/" className="mobile-home-link min-h-11 content-center text-sm font-semibold text-[var(--accent)]">Home</Link>
        <nav className="desktop-nav flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-label="Main navigation">
          <Link className="min-h-11 content-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href="/">Home</Link>
          <Link className="min-h-11 content-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href="/browse?category=stays">Browse</Link>
          <Link className="min-h-11 content-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href="/write">Writing</Link>
          <Link className="min-h-11 content-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href="/#search">Search</Link>
          <Link className="min-h-11 content-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href={profileHref}>Profile</Link>
          {user ? <SignOutButton /> : null}
        </nav>
      </div>
    </header>
    <nav className="mobile-tabbar" aria-label="Mobile navigation">
      <Link href="/browse?category=stays"><span aria-hidden="true">⌂</span>Browse</Link>
      <Link href="/write"><span aria-hidden="true">✎</span>Writing</Link>
      <Link href="/#search"><span aria-hidden="true">⌕</span>Search</Link>
      <Link href={profileHref}><span aria-hidden="true">●</span>Profile</Link>
    </nav>
  </>;
}

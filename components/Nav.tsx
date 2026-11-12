import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MobileNavigation from "@/components/MobileNavigation";
import SignOutButton from "@/components/SignOutButton";

export default async function Nav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profileHref = user ? "/profile" : "/login";
  const { data: profile } = user
    ? await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.is_admin === true;
  return <>
    <header className="border-b border-[var(--line)] bg-[var(--paper)]">
      <div className="nav-container page-shell flex min-h-16 items-center justify-between gap-5">
        <Link href="/" className="flex min-h-11 items-center gap-2 font-semibold tracking-tight no-underline"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-sm font-bold text-white">U</span><span className="serif text-base sm:text-lg">Unfilteredpillowtalk</span></Link>
        <MobileNavigation profileHref={profileHref} signedIn={Boolean(user)} isAdmin={isAdmin} />
        <nav className="desktop-nav flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-label="Main navigation">
          <Link className="min-h-11 content-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href="/">Home</Link>
          <Link className="min-h-11 content-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href="/browse?category=stays">Browse</Link>
          <Link className="min-h-11 content-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href="/write">Writing</Link>
          <Link className="min-h-11 content-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href="/#search">Search</Link>
          <Link className="min-h-11 content-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href={profileHref}>Profile</Link>
          {isAdmin && <Link className="min-h-11 content-center text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href="/admin">Admin</Link>}
          {user ? <SignOutButton /> : null}
        </nav>
      </div>
    </header>
  </>;
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function Nav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <header className="border-b border-[var(--line)] bg-[var(--paper)]">
    <div className="nav-container page-shell flex min-h-16 items-center justify-between gap-5">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight no-underline"><span className="grid size-8 place-items-center rounded-md bg-[var(--coral)] text-sm font-bold text-white shadow-[0_2px_0_#a73d2d]">R</span><span className="serif text-lg">ReviewFinder</span></Link>
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link className="text-[var(--muted)] transition-colors hover:text-[var(--coral)]" href="/">Home</Link>
        <Link className="text-[var(--muted)] transition-colors hover:text-[var(--coral)]" href="/browse">Browse</Link>
        <Link className="text-[var(--muted)] transition-colors hover:text-[var(--coral)]" href="/write">Write</Link>
        {user ? <><Link className="text-[var(--muted)] transition-colors hover:text-[var(--coral)]" href="/profile">Profile</Link><SignOutButton /></> : <Link className="text-[var(--muted)] transition-colors hover:text-[var(--coral)]" href="/login">Sign in</Link>}
      </nav>
    </div>
  </header>;
}
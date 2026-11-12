"use client";

import Link from "next/link";
import { useState } from "react";
import SignOutButton from "@/components/SignOutButton";

export default function MobileNavigation({ profileHref, signedIn, isAdmin }: { profileHref: string; signedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return <div className="mobile-navigation">
    <button type="button" className={`menu-toggle ${open ? "is-open" : ""}`} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
      <span /><span /><span />
    </button>
    {open && <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile navigation">
      <Link href="/" onClick={close}>Home</Link>
      <Link href="/browse?category=stays" onClick={close}>Browse</Link>
      <Link href="/write" onClick={close}>Writing</Link>
      <Link href="/#search" onClick={close}>Search</Link>
      <Link href={profileHref} onClick={close}>Profile</Link>
      {isAdmin && <Link href="/admin" onClick={close}>Admin</Link>}
      {signedIn ? <SignOutButton /> : <Link href="/login" onClick={close}>Sign in</Link>}
    </nav>}
  </div>;
}

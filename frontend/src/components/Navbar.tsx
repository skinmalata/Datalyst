"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  { label: "Home", href: "/" },
  { label: "About", href: "#about" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Link href="/" className="flex items-center gap-2 text-lg font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm">D</span>
        DATALYST
      </Link>

      {/* Desktop */}
      <div className="hidden items-center gap-8 md:flex">
        {links.map(l => (
          <a key={l.label} href={l.href} className="text-sm text-text-secondary hover:text-white transition-colors">
            {l.label}
          </a>
        ))}
      </div>
      <div className="hidden items-center gap-4 md:flex">
        <Link href="/login" className="text-sm text-text-secondary hover:text-white transition-colors">Log in</Link>
        <Link href="/register" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity">Sign up</Link>
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex flex-col gap-1.5 md:hidden"
        aria-label="Toggle menu"
      >
        <span className={`block h-0.5 w-6 bg-white transition-transform ${open ? "translate-y-2 rotate-45" : ""}`} />
        <span className={`block h-0.5 w-6 bg-white transition-opacity ${open ? "opacity-0" : ""}`} />
        <span className={`block h-0.5 w-6 bg-white transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`} />
      </button>

      {/* Mobile menu */}
      {open && (
        <div className="absolute left-0 top-full z-50 w-full border-t border-border bg-surface px-6 py-6 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map(l => (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="text-sm text-text-secondary hover:text-white transition-colors">
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
              <Link href="/login" onClick={() => setOpen(false)} className="text-sm text-text-secondary hover:text-white transition-colors">Log in</Link>
              <Link href="/register" onClick={() => setOpen(false)} className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold hover:opacity-90 transition-opacity">Sign up</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

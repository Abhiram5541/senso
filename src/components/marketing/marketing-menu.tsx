"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

/** A small disclosure, so every marketing destination remains available on touch. */
export function MarketingMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div ref={root} className="lg:hidden">
      <button ref={trigger} type="button" aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open} aria-controls="landing-navigation" onClick={() => setOpen(!open)}
        className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-sunken">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && <nav id="landing-navigation" aria-label="Mobile" className="absolute inset-x-4 top-full mt-2 rounded-2xl bg-surface p-3 shadow-overlay">
        {links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 text-md font-medium text-ink hover:bg-brand-softer">{link.label}</Link>)}
        <Link href="/login" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 text-md font-medium text-brand-ink hover:bg-brand-softer">Sign in</Link>
      </nav>}
    </div>
  );
}

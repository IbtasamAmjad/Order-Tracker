"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/** The red "Delete" pill that sits in the button row; its confirmation opens as a full-width box under the row. */
export function DeleteToggle({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-bad-soft px-3 text-base font-medium text-bad hover:brightness-95"
      >
        <Icon name="trash" className="h-5 w-5" /> {label}
      </button>
      {open && <div className="order-1 w-full basis-full space-y-3 rounded-2xl border border-bad/30 bg-bad-soft/50 p-4">{children}</div>}
    </>
  );
}

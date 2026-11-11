"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { Field, TitleIcon, btnPrimary, input } from "./ui";

/**
 * The Masters page header: the title on the left and a "+ Add master" button on the right (like "Add group").
 * Pressing it shows the form for a new master under the header; it starts open when there are no masters yet.
 */
export function AddMasterBox({ action, startOpen = false }: { action: (f: FormData) => Promise<void>; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TitleIcon name="masters" />
          <h1 className="page-title">Masters</h1>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${btnPrimary} shrink-0`}>
          <Icon name={open ? "close" : "plus"} className="h-4 w-4" /> {open ? "Close" : "Add master"}
        </button>
      </div>

      {open && (
        <form action={action} className="space-y-5 panel">
          <div className="flex items-center gap-3 border-b border-rule pb-4">
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-deep">
              <Icon name="plus" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-tight">Add a master</h2>
              <p className="text-sm text-muted">He gets a personal link and a PIN code.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
            <Field label="Name">
              <input name="name" required autoFocus placeholder="e.g. Naseem" className={input} />
            </Field>
            <Field label="PIN (numbers and letters)">
              <input name="pin" required placeholder="e.g. 1234A" className={input} />
            </Field>
            <div className="md:col-span-2">
              <Field label="WhatsApp number (optional, with country code)">
                <input name="whatsapp" inputMode="tel" placeholder="e.g. 923001234567" className={input} />
              </Field>
            </div>
          </div>

          <button className={`${btnPrimary} w-full`}>
            <Icon name="plus" className="h-5 w-5" /> Add master
          </button>
        </form>
      )}
    </>
  );
}

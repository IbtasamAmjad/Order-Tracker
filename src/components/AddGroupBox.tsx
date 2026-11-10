"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { Field, btnPrimary, input } from "./ui";

const colourInput = "h-12 w-14 shrink-0 cursor-pointer rounded-full border border-muted bg-paper p-1";

/**
 * The Items page header: the title on the left and a "+ Add group" button on the right (like "New customer").
 * Pressing the button shows the form for a new group right under the header; it starts open when there are no groups yet.
 */
export function AddGroupBox({
  title,
  sub,
  action,
  startOpen = false,
}: {
  title: string;
  sub: string;
  action: (f: FormData) => Promise<void>;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          <p className="page-sub mt-1">{sub}</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${btnPrimary} shrink-0`}>
          <Icon name="plus" className="h-4 w-4" /> Add group
        </button>
      </div>

      {open && (
        <form action={action} className="space-y-3 panel">
          <h2 className="text-xl font-medium">Add a group</h2>
          <Field label="Group name" hint="For example: Men, Ladies, Shoes">
            <input name="name" required autoFocus className={input} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <input type="color" name="colour" defaultValue="#64748b" className={colourInput} aria-label="Colour" />
            <button className={btnPrimary}>Add group</button>
          </div>
        </form>
      )}
    </>
  );
}

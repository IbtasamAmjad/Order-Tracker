"use client";

import { useRef, useState } from "react";
import { Icon } from "./Icon";

/** The master's personal link with a Copy button. The line can also be selected by hand. */
export function CopyLink({ link }: { link: string }) {
  const [done, setDone] = useState(false);
  const box = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // the clipboard is blocked on plain http addresses: select the text and use the old way
      box.current?.select();
      document.execCommand("copy");
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-rule bg-paper-3/60 p-2 pl-3">
      <Icon name="link" className="h-5 w-5 shrink-0 text-muted" />
      <input
        ref={box}
        readOnly
        value={link}
        aria-label="Personal link"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 truncate bg-transparent text-base outline-none"
      />
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-accent-soft px-3 text-base font-medium text-accent-deep"
      >
        <Icon name={done ? "check" : "copy"} className="h-4 w-4" />
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { removeNotePictureAction } from "@/app/admin/actions";
import { Icon } from "./Icon";
import { PictureInput } from "./PictureInput";

/**
 * The pictures under a customer's "Extra notes": the ones already saved (tap to open, cross to take one off) and the
 * picture box. There is no switch to turn on: it is always there. `form` ties the file box to the order form when
 * this sits outside it.
 */
export function NotePictures({ orderId, saved = [], form, inline }: { orderId?: number; saved?: { id: number }[]; form?: string; inline?: React.ReactNode }) {
  const [gone, setGone] = useState<number[]>([]);
  const shown = saved.filter((p) => !gone.includes(p.id));
  return (
    <div className={inline ? "space-y-2" : "mt-2 space-y-2"}>
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shown.map((p) => (
            <div key={p.id} className="relative h-12 w-12">
              <a href={`/api/admin/photos/${p.id}`} target="_blank" rel="noreferrer" className="block h-full w-full overflow-hidden rounded-xl border border-rule bg-paper-3" aria-label="Open this picture">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/photos/${p.id}?thumb=1`} alt="Picture under the notes" className="h-full w-full object-cover" />
              </a>
              {orderId && (
                <button
                  type="button"
                  aria-label="Remove this picture"
                  onClick={async () => {
                    if (!window.confirm("Remove this picture?")) return;
                    setGone((g) => [...g, p.id]);
                    await removeNotePictureAction(orderId, p.id);
                  }}
                  className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-ink text-white"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <PictureInput name="pic:notes" pasteInto={["details"]} form={form} inline={inline} tall />
    </div>
  );
}

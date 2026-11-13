"use client";

import { useState } from "react";
import { removeItemPictureAction } from "@/app/admin/actions";
import { Icon } from "./Icon";

/**
 * The pictures already saved on a field: small pictures to tap and open full size, a cross on each to take it off
 * (asks first), and one "Download all" button (a single picture keeps its own small download icon).
 */
export function SavedPictures({ photos: all, label, itemId }: { photos: { id: number }[]; label: string; itemId: number }) {
  const [gone, setGone] = useState<number[]>([]);
  const photos = all.filter((p) => !gone.includes(p.id));
  if (photos.length === 0) return null;
  const many = photos.length > 1;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-rule pt-2">
      {photos.map((p) => (
        <div key={p.id} className="relative h-11 w-11">
          <a
            href={`/api/admin/photos/${p.id}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Open this picture"
            className="block h-full w-full overflow-hidden rounded-lg border border-rule bg-paper-3 shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/admin/photos/${p.id}?thumb=1`} alt={label} className="h-full w-full object-cover" />
          </a>
          <button
            type="button"
            aria-label="Remove this picture"
            onClick={async () => {
              if (!window.confirm("Remove this picture?")) return;
              setGone((g) => [...g, p.id]);
              await removeItemPictureAction(itemId, p.id);
            }}
            className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-white"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <a
        href={many ? `/api/admin/items/${itemId}/pictures?ids=${photos.map((p) => p.id).join(",")}` : `/api/admin/photos/${photos[0].id}?download=1`}
        download
        className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-accent-deep hover:bg-accent-soft"
      >
        <Icon name="download" className="h-4 w-4" />
        {many ? `Download all (${photos.length})` : "Download"}
      </a>
    </div>
  );
}

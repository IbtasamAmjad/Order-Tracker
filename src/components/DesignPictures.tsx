import { referencePhotos } from "@/lib/stages";

/**
 * "The design the customer chose": the reference pictures of an item as small pictures. Tap one to open it full size.
 */
export function DesignPictures({ token, itemId, fieldKeys }: { token: string; itemId: number; fieldKeys: string[] }) {
  const pics = referencePhotos(itemId).filter((r) => fieldKeys.includes(r.fieldKey ?? ""));
  if (pics.length === 0) return null;
  const img = (id: number, thumb = false) => `/api/m/${token}/photos/${id}${thumb ? "?thumb=1" : ""}`;
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-xl font-medium">
        <span aria-hidden className="inline-block h-6 w-1.5 rounded-full bg-accent" />
        The design the customer chose
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {pics.map((r) => (
          <a
            key={r.id}
            href={img(r.id)}
            target="_blank"
            rel="noreferrer"
            className="block aspect-square overflow-hidden rounded-2xl border border-rule bg-paper-3"
            aria-label="Open the design picture full size"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(r.id, true)} alt="The design the customer chose" className="h-full w-full object-cover" />
          </a>
        ))}
      </div>
      <p className="text-base text-muted">Tap a picture to see it big.</p>
    </section>
  );
}

/** The pictures attached under one field (for example Embroidery details), as small pictures to tap and open full size. */
export function FieldPictures({ token, itemId, fieldKey, label }: { token: string; itemId: number; fieldKey: string; label: string }) {
  const pics = referencePhotos(itemId).filter((r) => r.fieldKey === fieldKey);
  if (pics.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {pics.map((r) => (
        <a key={r.id} href={`/api/m/${token}/photos/${r.id}`} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-2xl border border-rule bg-paper-3" aria-label={`Open the picture of ${label} full size`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/m/${token}/photos/${r.id}?thumb=1`} alt={label} className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

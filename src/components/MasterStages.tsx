import { itemStageViews, referencePhotos } from "@/lib/stages";
import type { FieldDef } from "@/db/schema";
import { completeStageAction } from "@/app/m/actions";
import { PhotoUpload } from "./PhotoUpload";
import { DownloadLink } from "@/components/DownloadLink";
import { btnPrimary } from "./ui";
import { Icon } from "@/components/Icon";

/** Reference pictures and the step list (with photo gate) for one item, for the master. */
export function MasterStages({
  token,
  orderId,
  itemId,
  fields,
  turn,
}: {
  token: string;
  orderId: number;
  itemId: number;
  fields: FieldDef[];
  turn: boolean; // is it this master's turn on the order (can he finish steps)?
}) {
  const stages = itemStageViews(itemId);
  const refs = referencePhotos(itemId);
  const labelOf = (key: string | null) => fields.find((f) => f.key === key)?.label ?? "Picture";
  const img = (id: number, thumb = false) => `/api/m/${token}/photos/${id}${thumb ? "?thumb=1" : ""}`;
  // the pictures grouped by the field they belong to, in the order of the form
  const groups = [...new Set(refs.map((r) => r.fieldKey ?? ""))].map((key) => ({
    label: labelOf(key || null),
    photos: refs.filter((r) => (r.fieldKey ?? "") === key),
  }));

  return (
    <>
      {groups.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xl font-medium">Pictures</p>
            {refs.length > 1 && (
              <a href={`/api/m/${token}/items/${itemId}/pictures`} download className="btn btn-quiet h-auto min-h-11 gap-2 px-4 py-2 text-base">
                <Icon name="download" className="h-5 w-5 shrink-0" />
                Download all ({refs.length})
              </a>
            )}
          </div>
          {groups.map((g) => (
            <div key={g.label} className="space-y-2">
              <p className="flex items-center gap-2 text-base font-medium text-muted">
                {g.label}
                <span className="rounded-full bg-paper-3 px-2 text-sm text-ink">{g.photos.length}</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {g.photos.map((r) => (
                  <div key={r.id} className="relative aspect-square overflow-hidden rounded-2xl border border-rule bg-paper-3">
                    <a href={img(r.id)} target="_blank" rel="noreferrer" className="block h-full w-full" aria-label={`Open picture, ${g.label}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img(r.id, true)} alt={g.label} className="h-full w-full object-cover" />
                    </a>
                    <a
                      href={`${img(r.id)}?download=1`}
                      download
                      aria-label="Download this picture"
                      title="Download"
                      className="absolute bottom-1.5 right-1.5 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-ink shadow"
                    >
                      <Icon name="download" className="h-5 w-5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {stages.length > 0 && (
        <div className="space-y-2">
          <p className="text-lg font-medium">Steps</p>
          <ol className="space-y-2">
            {stages.map((s, n) => {
              const photo = s.latestPhoto;
              return (
                <li
                  key={s.key}
                  className={`space-y-2 rounded-2xl p-4 ${s.status === "open" ? "bg-accent-soft" : "bg-paper-3"}`}
                >
                  <div className="text-xl font-medium">
                    {s.status === "done" ? <Icon name="check" className="mr-1 inline h-5 w-5" /> : s.status === "locked" ? <Icon name="lock" className="mr-1 inline h-5 w-5" /> : null}
                    {n + 1}. {s.label}
                  </div>

                  {s.status === "open" && s.photo !== "none" && (
                    <div className="space-y-2">
                      <p className="text-lg">{s.photo === "required" ? "Photo needed" : "Photo (optional)"}</p>
                      {photo && (
                        <div className="space-y-2">
                        <div className="flex flex-wrap items-start gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img(photo.id, true)} alt="Your photo" className="h-24 w-24 border object-cover" />
                          <p
                            className={`text-lg font-medium ${
                              photo.status === "approved" ? "text-leaf" : photo.status === "rejected" ? "text-thread" : "text-ink"
                            }`}
                          >
                            {photo.status === "pending" && "Waiting for approval"}
                            {photo.status === "approved" && "Approved ✓"}
                            {photo.status === "rejected" && `Rejected: ${photo.comment ?? "please send a new photo"}`}
                          </p>
                        </div>
                        <DownloadLink href={img(photo.id)} />
                        </div>
                      )}
                      {(!photo || photo.status === "rejected") && (
                        <PhotoUpload
                          endpoint={`/api/m/${token}/photos`}
                          fields={{ itemId: String(itemId), stageKey: s.key }}
                          label={photo ? "Send a new photo" : "Take photo"}
                          camera
                        />
                      )}
                    </div>
                  )}

                  {s.status === "open" && s.requiredFields.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-lg">{s.fieldsOk ? "Everything is filled in" : "Fill these in before you finish this step:"}</p>
                      <ul className="space-y-1">
                        {s.requiredFields.map((rf) => (
                          <li key={rf.key} className={`flex items-center gap-2 text-base ${rf.filled ? "text-leaf" : "text-ink"}`}>
                            <Icon name={rf.filled ? "check" : "alert"} className="h-5 w-5 shrink-0" />
                            <span>
                              {rf.label}
                              {!rf.filled && !rf.masterCanEdit && " (the office fills this in)"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {s.status === "open" &&
                    (turn ? (
                      s.photoOk &&
                      s.fieldsOk && (
                        <form action={completeStageAction}>
                          <input type="hidden" name="token" value={token} />
                          <input type="hidden" name="orderId" value={orderId} />
                          <input type="hidden" name="itemId" value={itemId} />
                          <input type="hidden" name="stageKey" value={s.key} />
                          <button className={`${btnPrimary} w-full`}>Mark complete</button>
                        </form>
                      )
                    ) : (
                      <p className="text-base">You can finish this step after the orders above it.</p>
                    ))}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </>
  );
}

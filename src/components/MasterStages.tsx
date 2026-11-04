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

  return (
    <>
      {refs.length > 0 && (
        <div className="space-y-2">
          <p className="text-lg font-medium">Pictures</p>
          <div className="flex flex-wrap gap-2">
            {refs.map((r) => (
              <div key={r.id} className="space-y-1 text-center text-sm">
                <a href={img(r.id)} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(r.id, true)} alt={labelOf(r.fieldKey)} className="h-28 w-28 border object-cover" />
                  {labelOf(r.fieldKey)}
                </a>
                <DownloadLink href={img(r.id)} label="Download" className="w-28 !px-2" />
              </div>
            ))}
          </div>
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
                        <div className="flex items-start gap-3">
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

"use client";

import { useState } from "react";
import { sendShipmentAction } from "@/app/m/actions";
import { DownloadLink } from "./DownloadLink";
import { Icon } from "./Icon";
import { PhotoUpload } from "./PhotoUpload";
import { btnPrimary } from "./ui";

type Choice = { id: number; label: string };
export type LockedChoice = Choice & { blockers: string[] };

/** Items that cannot be sent yet, with exactly what is missing for each. */
export function LockedItems({ items }: { items: LockedChoice[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id} className="panel space-y-1">
          <div className="flex items-center gap-2 text-xl font-medium">
            <Icon name="lock" className="h-5 w-5 shrink-0 text-muted" />
            {i.label}
          </div>
          <p className="text-base text-muted">Not ready to send yet:</p>
          <ul className="list-disc space-y-0.5 pl-5 text-base">
            {i.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/**
 * The whole shipment on one page: choose the items, add the bill photo, send.
 * The ticks live in this component, so adding a photo (which refreshes the page) never loses them.
 */
export function ShipmentFlow({
  token,
  orderId,
  shipmentId,
  ready,
  locked,
  initialPicked,
  billPhotoId,
  packagePhotoId,
  error,
}: {
  token: string;
  orderId: number;
  shipmentId: number;
  ready: Choice[];
  locked: LockedChoice[];
  initialPicked: number[];
  billPhotoId: number | null;
  packagePhotoId: number | null;
  error: string | null;
}) {
  const [picked, setPicked] = useState<number[]>(initialPicked);
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const hasItems = picked.length > 0;
  const hasBill = billPhotoId !== null;
  const canSend = hasItems && hasBill;
  const photoUrl = (id: number) => `/api/m/${token}/photos/${id}`;
  const endpoint = `/api/m/${token}/shipments/${shipmentId}/photos`;
  const mark = (ok: boolean) => <Icon name={ok ? "check" : "alert"} className={`h-5 w-5 shrink-0 ${ok ? "text-leaf" : "text-muted"}`} />;

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-2xl bg-thread/10 p-4 text-lg font-medium text-thread">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-medium">1. What are you sending?</h2>
        <p className="text-lg">Tick each item you checked is here and are sending now.</p>
        <ul className="space-y-2">
          {ready.map((i) => (
            <li key={i.id}>
              <label className="panel flex cursor-pointer items-center gap-4 text-xl font-medium">
                <input
                  type="checkbox"
                  checked={picked.includes(i.id)}
                  onChange={() => toggle(i.id)}
                  className="checkbox checkbox-primary h-7 w-7 shrink-0"
                />
                <span>
                  {i.label}
                  <span className="block text-base font-normal text-muted">I checked it is here</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <LockedItems items={locked} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">2. Photo of the bill</h2>
        <p className="text-lg">One bill can be for many items.</p>
        {billPhotoId !== null && (
          <div className="flex flex-wrap items-center gap-3">
            <a href={photoUrl(billPhotoId)} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${photoUrl(billPhotoId)}?thumb=1`} alt="Bill" className="h-32 border" />
            </a>
            <DownloadLink href={photoUrl(billPhotoId)} label="Download bill" />
          </div>
        )}
        <PhotoUpload endpoint={endpoint} fields={{ kind: "bill" }} label={hasBill ? "Take the bill photo again" : "Take photo of bill"} camera quiet />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">3. Photo of the packed items (optional)</h2>
        {packagePhotoId !== null && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${photoUrl(packagePhotoId)}?thumb=1`} alt="Packed items" className="h-32 border" />
        )}
        <PhotoUpload endpoint={endpoint} fields={{ kind: "package" }} label={packagePhotoId !== null ? "Take the photo again" : "Take photo of packed items"} camera quiet />
      </section>

      <form action={sendShipmentAction} className="panel space-y-3">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="shipmentId" value={shipmentId} />
        {picked.map((id) => (
          <span key={id}>
            <input type="hidden" name="inc" value={id} />
            <input type="hidden" name="chk" value={id} />
          </span>
        ))}
        <h2 className="text-xl font-medium">4. Send</h2>
        <ul className="space-y-1 text-xl">
          <li className="flex items-center gap-2">
            {mark(hasItems)} {hasItems ? `${picked.length} item${picked.length === 1 ? "" : "s"} chosen` : "Choose the items"}
          </li>
          <li className="flex items-center gap-2">
            {mark(hasBill)} {hasBill ? "Bill photo added" : "Add the bill photo"}
          </li>
        </ul>
        <button disabled={!canSend} className={`${btnPrimary} w-full`}>
          Send to shipping
        </button>
      </form>
    </div>
  );
}

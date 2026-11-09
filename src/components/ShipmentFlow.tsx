"use client";

import { useState } from "react";
import { sendShipmentAction } from "@/app/m/actions";
import { DownloadLink } from "./DownloadLink";
import { Icon } from "./Icon";
import { PhotoUpload } from "./PhotoUpload";

type Choice = { id: number; label: string; sub?: string }; // sub: the customer and design number
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

/** A step heading: the number in grey, the title, and a short line under it. */
function StepTitle({ n, children, note, hint }: { n: number; children: React.ReactNode; note?: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="flex items-center gap-2 text-xl font-medium">
        <span className="text-muted">{n}.</span>
        <span className="flex-1">{children}</span>
        {note && <span className="rounded-full border border-rule-2 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted">{note}</span>}
      </h2>
      {hint && <p className="text-base text-muted">{hint}</p>}
    </div>
  );
}

/** A box for a photo: a dashed area with a camera, the button inside it. */
function DropBox({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="space-y-3 rounded-2xl border-2 border-dashed border-rule-2 bg-paper-2 p-4 text-center">
      <Icon name="photos" className="mx-auto h-8 w-8 text-muted" />
      <p className="text-base text-muted">{text}</p>
      {children}
    </div>
  );
}

/** A small tag on the right of a checklist row. */
function Tag({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${on ? "bg-ok-soft text-ok" : "border border-rule-2 text-muted"}`}>{children}</span>;
}

/**
 * The whole shipment on one page: choose the items, add the bill photo, send.
 * The ticks live in this component, so adding a photo (which refreshes the page) never loses them.
 */
export function ShipmentFlow({
  token,
  orderId,
  shipmentId,
  turnOk,
  ready,
  locked,
  initialPicked,
  billPhotoId,
  packagePhotoId,
  error,
}: {
  token: string;
  orderId: number;
  shipmentId: number | null; // null until a photo is added or Send is pressed
  turnOk: boolean;
  ready: Choice[];
  locked?: LockedChoice[];
  initialPicked: number[];
  billPhotoId: number | null;
  packagePhotoId: number | null;
  error: string | null;
}) {
  const [picked, setPicked] = useState<number[]>(initialPicked);
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const hasItems = picked.length > 0;
  const hasBill = billPhotoId !== null;
  const canSend = hasItems && hasBill && turnOk;
  const photoUrl = (id: number) => `/api/m/${token}/photos/${id}`;
  const endpoint = `/api/m/${token}/orders/${orderId}/ship-photos`;
  const mark = (ok: boolean) => <Icon name={ok ? "check" : "alert"} className={`h-5 w-5 shrink-0 ${ok ? "text-leaf" : "text-muted"}`} />;

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-8">
        {!turnOk && (
          <p role="status" className="rounded-2xl bg-paper-3 p-4 text-lg font-medium">
            You can send this order after the orders above it. You can still get the bill photo ready now.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-thread/10 p-4 text-lg font-medium text-thread">
            {error}
          </p>
        )}

        <section className="space-y-3">
          <StepTitle n={1} hint="Every finished item is here. Take out any you are not sending today.">
            What are you sending?
          </StepTitle>
          <ul className="space-y-2">
            {ready.map((i) => {
              const on = picked.includes(i.id);
              return (
                <li key={i.id} className={`flex items-center gap-3 rounded-2xl border bg-paper-2 p-4 shadow-sm ${on ? "border-ink" : "border-rule-2"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-xl font-medium">{i.label}</span>
                      <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">Ready</span>
                    </span>
                    {i.sub && <span className="block text-base font-medium text-ink-2">{i.sub}</span>}
                    <span className="mt-0.5 flex items-center gap-1.5 text-base text-muted">
                      <Icon name="check" className="h-4 w-4 text-ok" /> I checked it is here
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(i.id)}
                    aria-pressed={on}
                    className={`btn h-auto min-h-11 shrink-0 gap-2 px-5 py-2 text-base ${on ? "!border-ink !bg-ink !text-white" : "btn-quiet"}`}
                  >
                    <Icon name={on ? "check" : "plus"} className="h-4 w-4" />
                    {on ? "Added" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
          <LockedItems items={locked ?? []} />
        </section>

        <section className="space-y-3">
          <StepTitle n={2} hint="One bill can be for many items.">
            Photo of the bill
          </StepTitle>
          {billPhotoId !== null ? (
            <div className="space-y-3 rounded-2xl border border-rule-2 bg-paper-2 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <a href={photoUrl(billPhotoId)} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${photoUrl(billPhotoId)}?thumb=1`} alt="Bill" className="h-16 w-16 rounded-xl border object-cover" />
                </a>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium">Bill photo</p>
                  <p className="flex items-center gap-1 text-base text-ok">
                    <Icon name="check" className="h-4 w-4" /> Added
                  </p>
                </div>
                <DownloadLink href={photoUrl(billPhotoId)} label="Download bill" />
              </div>
              <PhotoUpload endpoint={endpoint} fields={{ kind: "bill" }} label="Take the bill photo again" camera quiet />
            </div>
          ) : (
            <DropBox text="Take a clear photo of the bill.">
              <PhotoUpload endpoint={endpoint} fields={{ kind: "bill" }} label="Take photo of bill" camera quiet />
            </DropBox>
          )}
        </section>

        <section className="space-y-3">
          <StepTitle n={3} note="Optional" hint="Show the items packed and ready for the courier.">
            Photo of the packed items
          </StepTitle>
          {packagePhotoId !== null ? (
            <div className="space-y-3 rounded-2xl border border-rule-2 bg-paper-2 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${photoUrl(packagePhotoId)}?thumb=1`} alt="Packed items" className="h-16 w-16 shrink-0 rounded-xl border object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium">Packed items</p>
                  <p className="flex items-center gap-1 text-base text-ok">
                    <Icon name="check" className="h-4 w-4" /> Added
                  </p>
                </div>
              </div>
              <PhotoUpload endpoint={endpoint} fields={{ kind: "package" }} label="Take the photo again" camera quiet />
            </div>
          ) : (
            <DropBox text="You can skip this.">
              <PhotoUpload endpoint={endpoint} fields={{ kind: "package" }} label="Take photo of packed items" camera quiet />
            </DropBox>
          )}
        </section>
      </div>

      <form action={sendShipmentAction} className="space-y-4 overflow-hidden rounded-3xl border border-rule-2 bg-paper-2 p-5 shadow-md lg:sticky lg:top-4">
        <span aria-hidden className="-mx-5 -mt-5 mb-1 block h-1 bg-gradient-to-r from-accent via-accent-deep to-ink" />
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="shipmentId" value={shipmentId ?? ""} />
        {picked.map((id) => (
          <span key={id}>
            <input type="hidden" name="inc" value={id} />
            <input type="hidden" name="chk" value={id} />
          </span>
        ))}
        <h2 className="flex items-center gap-2 text-xl font-medium">
          <Icon name="shipments" className="h-6 w-6 text-muted" />
          <span className="flex-1">Your shipment</span>
          <span className="grid h-7 min-w-7 place-items-center rounded-full border border-rule-2 px-2 text-base">{picked.length}</span>
        </h2>

        {picked.length > 0 && (
          <ul className="space-y-2">
            {ready
              .filter((i) => picked.includes(i.id))
              .map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-xl bg-paper-3 px-3 py-2 text-lg">
                  <span className="min-w-0 flex-1 break-words font-medium">
                    {i.label}
                    {i.sub && <span className="block text-sm font-normal text-muted">{i.sub}</span>}
                  </span>
                  <button type="button" onClick={() => toggle(i.id)} className="btn btn-quiet h-auto min-h-9 px-3 py-1 text-sm" aria-label={`Take ${i.label} out of the shipment`}>
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Before you send</p>
          <ul className="space-y-2 text-base">
            {[
              { ok: hasItems, text: hasItems ? `${picked.length} item${picked.length === 1 ? "" : "s"} chosen` : "Choose the items", tag: hasItems ? "Done" : "", on: true },
              { ok: hasBill, text: hasBill ? "Bill photo added" : "Add the bill photo", tag: hasBill ? "Attached" : "", on: true },
              { ok: packagePhotoId !== null, text: "Packed items photo", tag: packagePhotoId !== null ? "Attached" : "Optional", on: packagePhotoId !== null },
            ].map((r) => (
              <li key={r.text} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${r.ok ? "border-ok/30 bg-ok-soft/40" : "border-rule-2"}`}>
                {mark(r.ok)} <span className={r.ok ? "" : "text-muted"}>{r.text}</span>
                {r.tag && <Tag on={r.on}>{r.tag}</Tag>}
              </li>
            ))}
            {!turnOk && (
              <li className="flex items-center gap-2 rounded-xl border border-rule-2 px-3 py-2.5">
                {mark(false)} Wait for the orders above this one
              </li>
            )}
          </ul>
        </div>

        <button
          disabled={!canSend}
          className="btn h-auto min-h-14 w-full gap-2 rounded-xl border !border-ink !bg-ink px-5 py-3 text-lg !text-white disabled:!border-rule-2 disabled:!bg-paper-3 disabled:!text-muted"
        >
          Send to shipping <Icon name="arrow" className="h-5 w-5" />
        </button>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Icon name="info" className="h-4 w-4 shrink-0" /> The office can see it as soon as you send.
        </p>
      </form>
    </div>
  );
}

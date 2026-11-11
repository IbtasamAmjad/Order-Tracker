import Link from "next/link";
import { listMasters, masterIsUnused } from "@/lib/masters";
import { itemRows } from "@/lib/item-search";
import { APP_URL } from "@/lib/config";
import { CopyLink } from "@/components/CopyLink";
import { DeleteToggle } from "@/components/DeleteToggle";
import { AddMasterBox } from "@/components/AddMasterBox";
import { Icon } from "@/components/Icon";
import { btnDanger, btnSecondary, input } from "@/components/ui";
import { createMasterAction, deleteMasterAction, reissueLinkAction, setMasterActiveAction, setPinAction } from "../actions";

const WHATSAPP_ICON =
  "M12 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.200 5.200 0 0 0 1.100 2.800 11.900 11.900 0 0 0 4.600 4.100c1.700.7 2.400.8 3.200.7a2.700 2.700 0 0 0 1.800-1.300 2.200 2.200 0 0 0 .2-1.300c-.1-.1-.2-.2-.5-.3Z";

export default async function Masters({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const masters = listMasters();
  return (
    <div className="space-y-6">
      <AddMasterBox action={createMasterAction} startOpen={masters.length === 0} />

      {e === "has-work" && (
        <p role="alert" className="alert alert-warning text-base font-medium">
          This master has customers or history, so he cannot be deleted. Press Deactivate instead.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {masters.map((m) => {
          const link = `${APP_URL}/m/${m.token}`;
          const text = `Hello ${m.name}, this is your order link: ${link} . Ask me for your code. Please check it every day.`;
          const wa = `https://wa.me/${m.whatsappNumber ?? ""}?text=${encodeURIComponent(text)}`;
          const rows = itemRows(m.id);
          const made = rows.filter((r) => r.status === "ready" || r.status === "shipped").length;
          const pct = rows.length === 0 ? 0 : Math.round((made / rows.length) * 100);
          return (
            <li key={m.id} className="min-w-0 space-y-4 panel">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-[#7C3AED] text-2xl font-semibold text-white">
                  {m.name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 basis-32">
                  <div className="break-words text-2xl font-semibold leading-tight">{m.name}</div>
                  <div className={`mt-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide ${m.active ? "text-ok" : "text-thread"}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${m.active ? "bg-ok" : "bg-thread"}`} />
                    {m.active ? "Active" : "Inactive"}
                  </div>
                </div>
                <Link href={`/admin/masters/${m.id}`} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-accent-soft px-4 text-base font-medium text-accent-deep">
                  Items &amp; progress <Icon name="arrow" className="h-4 w-4" />
                </Link>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-rule bg-paper-3/60 p-3">
                <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-deep">
                  <Icon name="check" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium uppercase tracking-wide text-muted">Progress</div>
                  <div className="text-base font-medium">
                    {rows.length} {rows.length === 1 ? "item" : "items"} &middot; {made} made
                  </div>
                </div>
                <span className="rounded-xl border border-rule bg-white px-3 py-1.5 text-lg font-semibold">{pct}%</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-muted">His link</span>
                  <span className="text-sm text-muted">Tap Copy</span>
                </div>
                <CopyLink link={link} />
              </div>

              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-lg font-semibold text-white hover:brightness-95"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
                  <path d={WHATSAPP_ICON} />
                </svg>
                Send link on WhatsApp
              </a>

              <form action={setPinAction} className="space-y-3 rounded-2xl border border-rule bg-paper-3/60 p-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FEF3C7] text-[#B45309]">
                    <Icon name="lock" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold leading-tight">PIN code</h3>
                    <p className="text-sm text-muted">He types it to open his link.</p>
                  </div>
                </div>
                <input type="hidden" name="id" value={m.id} />
                <div className="flex flex-wrap gap-2">
                  <input name="pin" required placeholder="New PIN (e.g. 1234A)" aria-label="New PIN" className={`${input} min-w-0 flex-1 basis-40 !bg-white`} />
                  <button className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#0F172A] px-6 text-base font-semibold text-white hover:bg-[#1E293B]">Set PIN</button>
                </div>
              </form>

              <div className="flex flex-wrap gap-1.5">
                <form action={setMasterActiveAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="active" value={m.active ? "0" : "1"} />
                  <button className={`${btnSecondary} !px-3`}>{m.active ? "Deactivate" : "Activate"}</button>
                </form>
                <DeleteToggle label="Delete">
                  {masterIsUnused(m.id) ? (
                    <form action={deleteMasterAction} className="space-y-3">
                      <p>He has no customers yet. This removes him and his link for good.</p>
                      <input type="hidden" name="id" value={m.id} />
                      <button className={btnDanger}>Yes, delete {m.name}</button>
                    </form>
                  ) : (
                    <p>{m.name} has customers or history, so he cannot be deleted. Use Deactivate: his link stops and everything stays on record.</p>
                  )}
                </DeleteToggle>
                <form action={reissueLinkAction} className="order-2" title="The old link stops working">
                  <input type="hidden" name="id" value={m.id} />
                  <button className={`${btnSecondary} !px-3`}>New link</button>
                </form>
              </div>

            </li>
          );
        })}
      </ul>
    </div>
  );
}

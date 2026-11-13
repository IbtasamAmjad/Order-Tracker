"use client";

import { useRef, useState, useTransition } from "react";
import { removeOrderFileAction } from "@/app/admin/actions";
import { Icon } from "./Icon";
import { btnSecondary } from "./ui";

export type PdfRow = { id: number; name: string; bytes: number };

const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Admin: the PDFs of a customer. Choose a PDF here and it is saved with the customer (it travels with the Save button). */
export function OrderPdfBox({ orderId, files }: { orderId?: number; files: PdfRow[] }) {
  const [list, setList] = useState(files);
  const [chosen, setChosen] = useState<File[]>([]);
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  // the file box always holds exactly the files in the "to be saved" list, so Save sends them
  function setFiles(next: File[]) {
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    if (input.current) input.current.files = dt.files;
    setChosen(next);
  }

  return (
    <section className="rounded-3xl border border-rule bg-paper-2 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-deep">
          <Icon name="note" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-medium leading-tight">Order PDF</h2>
          <p className="text-sm text-muted">Attach the order as a PDF. With a PDF, the fields below may stay empty.</p>
        </div>
      </div>

      {list.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-rule bg-white px-3 py-2">
              <span className="min-w-0 flex-1 basis-40 break-words text-base">
                {f.name} <span className="text-sm text-muted">({size(f.bytes)})</span>
              </span>
              <a href={`/api/admin/orders/${orderId}/files/${f.id}`} target="_blank" rel="noreferrer" className={btnSecondary}>
                View
              </a>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full text-bad hover:bg-bad-soft"
                aria-label={`Remove ${f.name}`}
                onClick={() => {
                  if (!window.confirm(`Remove ${f.name} from this customer?`)) return;
                  start(async () => {
                    await removeOrderFileAction(orderId!, f.id);
                    setList((l) => l.filter((x) => x.id !== f.id));
                  });
                }}
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-muted">{list.length > 0 ? "Add another PDF" : "Choose a PDF"}</span>
        <input
          ref={input}
          type="file"
          name="orderPdf"
          accept="application/pdf,.pdf"
          multiple
          className="file-input file-input-bordered w-full"
          onChange={(e) => {
            // more files are added to the ones already chosen
            const more = Array.from(e.target.files ?? []);
            const same = (a: File, b: File) => a.name === b.name && a.size === b.size;
            setFiles([...chosen, ...more.filter((m) => !chosen.some((c) => same(c, m)))]);
          }}
        />
      </label>
      {chosen.length > 0 && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-muted">Saved when you press Save:</p>
          <ul className="space-y-2">
            {chosen.map((c, i) => (
              <li key={`${c.name}-${c.size}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-rule bg-white px-3 py-2">
                <span className="min-w-0 flex-1 basis-40 break-words text-base">
                  {c.name} <span className="text-sm text-muted">({size(c.size)})</span>
                </span>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-full text-bad hover:bg-bad-soft"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => setFiles(chosen.filter((_, n) => n !== i))}
                >
                  <Icon name="close" className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

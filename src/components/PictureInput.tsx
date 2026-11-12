"use client";

import imageCompression from "browser-image-compression";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { btnSecondary } from "./ui";

/**
 * Pictures picked in the customer form but not saved yet, by field name. The form is shown again after a warning
 * ("You haven't given..."), and a file box cannot be refilled by the page, so the form keeps the pictures here.
 */
export const PictureStore = createContext<Map<string, File[]> | null>(null);

/**
 * A picture field on the customer form: choose several pictures (or take them), see them, remove the wrong ones.
 * They are shrunk on this computer or phone first and are saved together with the customer when Save is pressed.
 * With pasteInto (the names of the item's text boxes), a picture pasted into any of those boxes (Ctrl+V) is added here too,
 * and also waits for Save.
 */
export function PictureInput({
  name,
  pasteInto = [],
  form,
  inline,
  tall = false,
  pasteOnly = false,
}: {
  name: string;
  pasteInto?: string[];
  form?: string;
  /** a text box to sit in the same row: the picture button then shrinks to a small + at the end of that box */
  inline?: ReactNode;
  /** the box beside the + is a tall one (long writing): the + sits at its bottom */
  tall?: boolean;
  /** no button: only a picture pasted into the named text box is kept (its small thumbnail shows under the box) */
  pasteOnly?: boolean;
}) {
  const store = useContext(PictureStore);
  const box = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>(() => store?.get(name) ?? []);
  const latest = useRef<File[]>(files); // the newest list, for work that finishes after the render it started in
  useEffect(() => {
    latest.current = files;
  }, [files]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function fill(list: File[]) {
    const data = new DataTransfer();
    list.forEach((f) => data.items.add(f));
    if (box.current) box.current.files = data.files;
  }

  function keep(next: File[]) {
    fill(next);
    store?.set(name, next);
    setFiles(next);
  }

  // the form was shown again: put the pictures back into the file box so they are still sent
  useEffect(() => {
    fill(store?.get(name) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(picked: File[]) {
    if (picked.length === 0) {
      keep(latest.current);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const small: File[] = [];
      for (const file of picked) {
        const out = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1600, useWebWorker: true });
        small.push(new File([out], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: out.type || "image/jpeg" }));
      }
      keep([...latest.current, ...small]);
    } catch {
      setError("Could not prepare one of the pictures. Please try again.");
      keep(latest.current);
    } finally {
      setBusy(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    return add(Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/")));
  }

  // a picture pasted into the text box: keep it here until Save (text pasted as usual still goes into the box)
  useEffect(() => {
    if (pasteInto.length === 0) return;
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target;
      if (!(t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) || !pasteInto.includes(t.name)) return;
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      e.preventDefault();
      void add(images);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteInto.join("|")]);

  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  /** the chosen pictures: small ones in the row beside a box (small = 40px), a bit bigger on their own */
  const thumbs = (small: boolean) =>
    urls.length === 0 ? null : (
      <div className={small ? "mt-2 flex flex-wrap items-center gap-2 border-t border-rule pt-2" : "flex flex-wrap gap-2"}>
        {urls.map((u, i) => (
          <div key={u} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Picture ${i + 1}`} className={`${small ? "h-11 w-11" : "h-16 w-16"} rounded-lg border border-rule object-cover shadow-sm`} />
            <button
              type="button"
              aria-label={`Remove picture ${i + 1}`}
              onClick={() => keep(files.filter((_, n) => n !== i))}
              className={`absolute -right-1.5 -top-1.5 grid place-items-center rounded-full border border-rule bg-white text-ink shadow-sm hover:bg-bad-soft hover:text-bad ${small ? "h-5 w-5" : "h-6 w-6"}`}
            >
              <Icon name="close" className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    );

  if (pasteOnly) {
    return (
      <div className={files.length > 0 || error ? "mt-1 space-y-1" : "hidden"}>
        <input ref={box} type="file" name={name} form={form} accept="image/*" multiple onChange={onPick} className="hidden" />
        {files.length > 0 && thumbs(true)}
        {error && <p className="text-sm font-medium text-thread">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input ref={box} type="file" name={name} form={form} accept="image/*" multiple onChange={onPick} className="hidden" />
      {inline ? (
        <>
        <div className={`flex gap-2 ${tall ? "items-end" : "items-center"}`}>
          <div className="min-w-0 flex-1">{inline}</div>
          <button
            type="button"
            disabled={busy}
            onClick={() => box.current?.click()}
            title="Add pictures, or paste one with Ctrl+V"
            aria-label={busy ? "Preparing pictures" : "Add pictures"}
            className={`${btnSecondary} !w-12 shrink-0 !px-0`}
          >
            <Icon name={busy ? "clock" : "plus"} className="h-5 w-5" />
          </button>
        </div>
        {/* the chosen pictures sit under the box they belong to */}
        {thumbs(true)}
        </>
      ) : (
        <>
        {thumbs(false)}
        {/* a spot to paste into: click it, then Ctrl+V (a picture copied from WhatsApp or the screen); files can be dropped on it too */}
        {/* an editable spot, so a phone shows its own "Paste" bubble on a long press (a plain box does not) */}
        <div
          contentEditable
          suppressContentEditableWarning
          inputMode="none"
          spellCheck={false}
          role="textbox"
          aria-label="Paste or drop a picture here"
          data-ph={busy ? "Preparing..." : "Press and hold here, then tap Paste"}
          onPaste={(e) => {
            e.preventDefault(); // nothing is ever typed into this spot
            const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
            if (images.length > 0) void add(images);
            else setError("That was not a picture. Copy the picture itself, then paste.");
          }}
          onBeforeInput={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (!(e.ctrlKey || e.metaKey) && e.key.length === 1) e.preventDefault();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void add(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")));
          }}
          className="min-h-14 w-full cursor-text rounded-2xl border-2 border-dashed border-rule-2 bg-paper px-4 py-3 text-base text-ink outline-none before:text-muted before:content-[attr(data-ph)] focus:border-accent focus:bg-accent-soft/40"
        />
        <button type="button" disabled={busy} onClick={() => box.current?.click()} title="Choose pictures from this device" className="text-base font-medium text-accent-deep underline">
          Or choose files
        </button>
        </>
      )}
      {!inline && files.length > 0 && <p className="text-sm text-muted">{files.length} ready. They are saved when you press Save.</p>}
      {error && <p className="text-base font-medium text-thread">{error}</p>}
    </div>
  );
}

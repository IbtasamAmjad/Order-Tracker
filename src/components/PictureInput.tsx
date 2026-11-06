"use client";

import imageCompression from "browser-image-compression";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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
 * With pasteInto (the name of a text box), a picture pasted into that box (Ctrl+V) is added here too, and also waits for Save.
 */
export function PictureInput({ name, pasteInto }: { name: string; pasteInto?: string }) {
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
    if (!pasteInto) return;
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target;
      if (!(t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) || t.name !== pasteInto) return;
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      e.preventDefault();
      void add(images);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteInto]);

  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  return (
    <div className="space-y-2">
      <input ref={box} type="file" name={name} accept="image/*" multiple onChange={onPick} className="hidden" />
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((u, i) => (
            <div key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Picture ${i + 1}`} className="h-24 w-24 rounded-xl border object-cover" />
              <button
                type="button"
                aria-label={`Remove picture ${i + 1}`}
                onClick={() => keep(files.filter((_, n) => n !== i))}
                className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-ink text-white"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" disabled={busy} onClick={() => box.current?.click()} className={btnSecondary}>
        <Icon name="plus" className="h-4 w-4" /> {busy ? "Preparing..." : files.length > 0 ? "Add more pictures" : "Add pictures"}
      </button>
      {files.length > 0 && <p className="text-base text-muted">{files.length} ready. They are saved when you press Save.</p>}
      {pasteInto && files.length === 0 && <p className="text-base text-muted">You can also paste a picture (Ctrl+V) while the cursor is in the box above.</p>}
      {error && <p className="text-base font-medium text-thread">{error}</p>}
    </div>
  );
}

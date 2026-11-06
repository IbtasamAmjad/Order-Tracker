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
 */
export function PictureInput({ name }: { name: string }) {
  const store = useContext(PictureStore);
  const box = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>(() => store?.get(name) ?? []);
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

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) {
      keep(files);
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
      keep([...files, ...small]);
    } catch {
      setError("Could not prepare one of the pictures. Please try again.");
      keep(files);
    } finally {
      setBusy(false);
    }
  }

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
      {error && <p className="text-base font-medium text-thread">{error}</p>}
    </div>
  );
}

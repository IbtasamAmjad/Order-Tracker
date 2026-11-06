"use client";

import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Lets Admin paste pictures straight into a comment box. When the cursor is in that box and a picture is on the
 * clipboard (a screenshot, or "Copy image"), it is shrunk and saved as a picture of that field; it appears in the
 * list above, on the master's screen and on the printed page. Pasted text still goes into the box as usual.
 */
export function PastePictures({ itemId, fieldKey }: { itemId: number; fieldKey: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const name = `v:${itemId}:${fieldKey}`;
    async function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (!(t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) || t.name !== name) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      e.preventDefault();
      try {
        for (const [n, file] of files.entries()) {
          setMsg(`Adding pasted picture ${n + 1} of ${files.length}...`);
          const small = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1600, useWebWorker: true });
          const form = new FormData();
          form.set("itemId", String(itemId));
          form.set("fieldKey", fieldKey);
          form.set("file", small, "pasted.jpg");
          const res = await fetch("/api/admin/photos", { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? "Could not add the picture.");
        }
        setMsg("Picture added.");
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Could not add the picture.");
      }
      router.refresh();
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [itemId, fieldKey, router]);

  return (
    <p className="text-base text-muted" role="status">
      {msg || "You can also paste a picture (Ctrl+V) while the cursor is in the box above."}
    </p>
  );
}

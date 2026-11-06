"use client";

import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { btnPrimary, btnSecondary } from "./ui";

/**
 * Picks / takes a photo, shrinks it on the phone (about 400 KB, long side 1600 px),
 * uploads it, then refreshes the page.
 */
export function PhotoUpload({
  endpoint,
  fields,
  label,
  camera = false,
  quiet = false,
  multiple = false,
}: {
  endpoint: string;
  fields: Record<string, string>;
  label: string;
  camera?: boolean;
  quiet?: boolean; // a secondary-looking button, when another button on the page is the main action
  multiple?: boolean; // choose several pictures at once; they are sent one after another
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setState("working");
    try {
      for (const [n, file] of files.entries()) {
        const of = files.length > 1 ? ` ${n + 1} of ${files.length}` : "";
        setMessage(`Preparing photo${of}...`);
        const small = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1600, useWebWorker: true });
        setMessage(`Sending${of}...`);
        const form = new FormData();
        for (const [k, v] of Object.entries(fields)) form.set(k, v);
        form.set("file", small, "photo.jpg");
        const res = await fetch(endpoint, { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Upload failed. Please try again.");
      }
      setState("idle");
      setMessage("");
      router.refresh();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Upload failed. Please try again.");
      router.refresh();
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        {...(camera ? { capture: "environment" as const } : {})}
        onChange={onPick}
        className="hidden"
      />
      <button type="button" disabled={state === "working"} onClick={() => input.current?.click()} className={`${quiet ? btnSecondary : btnPrimary} w-full`}>
        {state === "working" ? message : label}
      </button>
      {state === "error" && <p className="text-lg font-medium text-thread">{message}</p>}
    </div>
  );
}

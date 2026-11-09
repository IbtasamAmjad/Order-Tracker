"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Keeps a page live: every few seconds it asks the server for fresh numbers (the page keeps its place, nothing flashes),
 * and shows the time it was last updated. Made for a screen that stays open all day, like an office TV.
 */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [updated, setUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setUpdated(new Date()), 0); // the time is only known in the browser
    const timer = setInterval(() => {
      router.refresh();
      setUpdated(new Date());
    }, seconds * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [router, seconds]);

  return (
    <span className="inline-flex items-center gap-2 text-base font-medium text-ink" role="status">
      <span aria-hidden className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-ok" />
      </span>
      Live{updated ? `, updated ${updated.toLocaleTimeString("en-GB")}` : ""}
    </span>
  );
}

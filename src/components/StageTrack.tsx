import type { TrackStep } from "@/lib/track";

/**
 * The progress bar of an order or an item: Order received, the steps, Shipped. A ticked circle is done, a ringed one
 * is where the work is now, an empty one is still to come.
 */
export function StageTrack({ steps }: { steps: TrackStep[] }) {
  if (steps.length < 2) return null;
  const now = steps.find((s) => s.state === "current");
  return (
    <ol className="flex items-start" aria-label={now ? `Progress. Now: ${now.label}` : "Progress. All done"}>
      {steps.map((s, i) => (
        <li key={`${s.label}-${i}`} className="relative flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
          {i > 0 && (
            <span
              aria-hidden
              className={`absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2 ${s.state === "todo" ? "bg-rule-2" : "bg-accent"}`}
            />
          )}
          <span
            aria-hidden
            className={`relative z-10 grid h-6 w-6 place-items-center rounded-full border-2 ${
              s.state === "done"
                ? "border-accent bg-accent text-accent-ink"
                : s.state === "current"
                  ? "border-accent bg-paper-2"
                  : "border-rule-2 bg-paper-2"
            }`}
          >
            {s.state === "done" && (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            )}
            {s.state === "current" && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
          </span>
          <span className={`break-words px-0.5 text-xs leading-tight ${s.state === "current" ? "font-medium text-ink" : s.state === "done" ? "text-ink-2" : "text-muted"}`}>
            {s.label}
            <span className="sr-only">{s.state === "done" ? " (done)" : s.state === "current" ? " (now)" : ""}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

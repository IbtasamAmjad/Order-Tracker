import { describeEvent, type HistoryLine } from "@/lib/history";

/** The history of an order in plain words, newest first: who did what, and when. Notes and instructions show their text. */
export function HistoryList({ lines, empty = "Nothing has happened yet." }: { lines: HistoryLine[]; empty?: string }) {
  if (lines.length === 0) return <p className="text-base text-muted">{empty}</p>;
  return (
    <ol className="space-y-2">
      {lines.map((h) => (
        <li key={h.id} className="flex gap-3 text-base">
          <span aria-hidden className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${h.kind === "done" || h.kind === "shipped" ? "bg-ok" : h.kind === "note" || h.kind === "instruction" ? "bg-accent" : "bg-rule-2"}`} />
          <div className="min-w-0">
            <p>
              <span className="font-medium">{describeEvent(h)}</span>
              <span className="ml-2 text-sm text-muted">{h.at.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
            </p>
            {h.text && (h.kind === "note" || h.kind === "instruction") && <p className="whitespace-pre-wrap break-words rounded-xl bg-paper-3 px-3 py-1.5 text-ink-2">{h.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The notes on one step, oldest first. */
export function StepNotesList({ notes }: { notes: HistoryLine[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {notes.map((n) => (
        <li key={n.id} className="rounded-xl bg-white/80 px-3 py-2 text-base">
          <span className="block text-sm text-muted">
            {n.who}, {n.at.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <span className="whitespace-pre-wrap break-words">{n.text}</span>
        </li>
      ))}
    </ul>
  );
}

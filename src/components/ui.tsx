import type { ReactNode } from "react";
import { Icon } from "./Icon";

// Shared look, built on daisyUI (CSS only) with our own "tailor" theme (see globals.css).
// Rules: comfortable targets (52px+, bigger for masters), plain words, one strong action per area,
// status always shown in words as well as colour.

export const btn = "btn h-auto min-h-11 px-5 py-2 text-base leading-tight";
export const btnPrimary = `${btn} btn-primary`;
export const btnSecondary = `${btn} btn-quiet`;
export const btnDanger = `${btn} btn-danger`;

export const input = "input w-full min-h-11 text-base";
export const select = "select w-full min-h-11 text-base";
export const textarea = "textarea w-full text-base leading-snug";

/** A white card with a quiet border and soft shadow. */
export const card = "panel";

/** Small word label (status, badge). Colour plus text, never colour alone. */
export const chip = "badge badge-lg";
export const chipAttention = `${chip} badge-accent`;
export const chipDark = `${chip} badge-primary`;

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-base font-medium text-ink">{label}</span>
      {hint && <span className="mb-1.5 block text-sm text-muted">{hint}</span>}
      {children}
    </label>
  );
}

/** Title row for a page: heading, optional subtitle, and actions on the right. */
export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub mt-1">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Friendly message when a list has nothing in it. */
export function EmptyState({ title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-paper-2 px-6 py-10 text-center">
      <p className="text-xl font-medium">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-base text-muted">{children}</div>}
    </div>
  );
}

/** Success / error / info message with an icon (colour plus words). */
export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error" | "warning"; children: ReactNode }) {
  const style = {
    info: "bg-accent-soft text-ink",
    success: "bg-ok-soft text-ink",
    error: "bg-bad-soft text-ink",
    warning: "bg-paper-3 text-ink",
  }[tone];
  const icon = tone === "success" ? "check" : tone === "info" ? "info" : "alert";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-2xl px-5 py-3 text-base font-medium ${style}`}>
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/** The big position number on an order card: "do the list in this order". */
export function PositionTile({ n }: { n: number }) {
  return (
    <span aria-label={`Number ${n} in the list`} className="ticket shrink-0">
      {n}
    </span>
  );
}

/** Tape-measure progress bar. */
export function Ruler({ value, total, label }: { value: number; total: number; label?: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="ruler" role="img" aria-label={label ?? `${pct} percent`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** "2026-11-20" -> "20 November" (the year is added only when it is not this year). */
export function fmtDay(ymd: string, now: Date = new Date()): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d} ${MONTHS[m - 1]}${y === now.getFullYear() ? "" : ` ${y}`}`;
}

export function fmtDate(d: Date | null | undefined) {
  return d ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "";
}

"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import type { PrintLayout, SlipStyle } from "@/db/schema";
import { Icon } from "./Icon";
import { btnSecondary, select } from "./ui";

export type SlipField = { key: string; label: string; short?: string };

// what is under the pointer wins (a wide empty row must beat a small box in the tray that happens to be nearer its centre)
const underPointer: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : closestCenter(args);
};

const STYLES: { value: SlipStyle; name: string; hint: string }[] = [
  { value: "tailor", name: "Tailor slip", hint: "The tailor's sheet: names with the value on a line, and small notes." },
  { value: "karigar", name: "Karigar paper", hint: "Short names in rows, to write out by hand for the karigar." },
  { value: "both", name: "Both", hint: "The tailor slip and the karigar paper, one under the other." },
  { value: "none", name: "No slip", hint: "Nothing to cut off for this item." },
];

function Chip({ field }: { field: SlipField }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, touchAction: "manipulation" }}
      title={field.label}
      className="min-h-10 cursor-grab rounded-full border border-rule-2 bg-white px-4 text-base font-medium shadow-sm active:cursor-grabbing"
    >
      {field.short?.trim() || field.label}
    </button>
  );
}

function Lane({ id, keys, byKey, label, onRemove }: { id: string; keys: string[]; byKey: Map<string, SlipField>; label: string; onRemove?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="flex items-start gap-2">
      <span className="w-14 shrink-0 pt-2 text-sm font-medium text-muted">{label}</span>
      <SortableContext items={keys} strategy={horizontalListSortingStrategy}>
        <div ref={setNodeRef} className={`flex min-h-12 flex-1 flex-wrap items-center gap-2 rounded-2xl border border-dashed p-2 ${isOver ? "border-accent bg-accent-soft" : "border-rule-2 bg-paper"}`}>
          {keys.map((k) => (byKey.get(k) ? <Chip key={k} field={byKey.get(k)!} /> : null))}
          {keys.length === 0 && <span className="px-2 text-sm text-muted">Drop boxes here</span>}
        </div>
      </SortableContext>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-paper-3">
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * "Printed slips" of an item: which cut-off slip the printed order has (tailor slip, karigar paper, both or none), and for the
 * karigar paper the rows: drag the boxes of the form into rows in the order they are written on the karigar's paper.
 * Writes its choice into the form as `printLayout` (JSON). Only saved boxes can be placed (a new box has no key yet).
 */
export function PrintSlips({ fields, unsaved, initial, onChange }: { fields: SlipField[]; unsaved: number; initial: PrintLayout | null; onChange: (p: PrintLayout) => void }) {
  const [slip, setSlip] = useState<SlipStyle>(initial?.slip ?? "tailor");
  const valid = new Set(fields.map((f) => f.key));
  const [rows, setRows] = useState<string[][]>(() => (initial?.karigarRows ?? []).map((r) => r.filter((k) => valid.has(k))).filter((r) => r.length > 0));
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const placed = new Set(rows.flat());
  const tray = fields.map((f) => f.key).filter((k) => !placed.has(k));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // lane ids: "tray" and "row:0", "row:1"...
  const laneOf = (id: string): string | null => {
    if (id === "tray" || id.startsWith("row:")) return id;
    const r = rows.findIndex((row) => row.includes(id));
    return r >= 0 ? `row:${r}` : "tray";
  };

  function onDragOver(e: DragOverEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    const from = laneOf(active);
    const to = laneOf(over);
    if (from === to || !to) return;
    setRows((cur) => {
      const next = cur.map((r) => r.filter((k) => k !== active));
      if (to === "tray") return next;
      const i = Number(to.slice(4));
      const at = over.startsWith("row:") ? next[i].length : Math.max(0, next[i].indexOf(over));
      next[i] = [...next[i].slice(0, at), active, ...next[i].slice(at)];
      return next;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over || active === over) return;
    const lane = laneOf(active);
    if (!lane || lane === "tray" || laneOf(over) !== lane || over.startsWith("row:")) return;
    const i = Number(lane.slice(4));
    setRows((cur) => cur.map((r, n) => (n === i ? arrayMove(r, r.indexOf(active), r.indexOf(over)) : r)));
  }

  const layout: PrintLayout = { slip, ...(rows.some((r) => r.length) ? { karigarRows: rows.filter((r) => r.length) } : {}) };
  const showRows = slip === "karigar" || slip === "both";
  const layoutJson = JSON.stringify(layout);
  useEffect(() => {
    onChange(JSON.parse(layoutJson) as PrintLayout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutJson]);

  return (
    <section aria-label="Printed slips" className="space-y-3">
      <h2 className="text-2xl font-medium">Printed slips</h2>
      <div className="panel space-y-3">
        <label className="block">
          <span className="mb-1 block text-base font-medium">Cut-off slip on the printed order</span>
          <select value={slip} onChange={(e) => setSlip(e.target.value as SlipStyle)} className={select} aria-label="Cut-off slip on the printed order">
            {STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-sm text-muted">{STYLES.find((s) => s.value === slip)?.hint}</span>
        </label>

        {showRows && (
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-medium">Karigar paper rows</h3>
              <p className="text-sm text-muted">Drag the boxes into rows, in the order they are written on the paper. Boxes left out do not print. Nothing placed: all measurement boxes print in form order.</p>
              {unsaved > 0 && <p className="mt-1 text-sm font-medium text-bad">{unsaved} new {unsaved === 1 ? "box has" : "boxes have"} to be saved first before they can be placed here.</p>}
            </div>
            <DndContext id="karigar-rows" sensors={sensors} collisionDetection={underPointer} onDragOver={onDragOver} onDragEnd={onDragEnd}>
              <div className="space-y-2">
                {rows.map((r, i) => (
                  <Lane key={i} id={`row:${i}`} keys={r} byKey={byKey} label={`Row ${i + 1}`} onRemove={r.length === 0 ? () => setRows((cur) => cur.filter((_, n) => n !== i)) : undefined} />
                ))}
                <button type="button" onClick={() => setRows((cur) => [...cur, []])} className={`${btnSecondary} gap-2`}>
                  <Icon name="plus" className="h-4 w-4" /> Add a row
                </button>
              </div>
              <div className="mt-3">
                <Lane id="tray" keys={tray} byKey={byKey} label="Not used" />
              </div>
            </DndContext>
            <p className="text-sm text-muted">The name on the paper is the box&apos;s short name (set on the box), or its full name.</p>
          </div>
        )}
      </div>
    </section>
  );
}

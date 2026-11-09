"use client";

import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { duplicateFieldNames } from "@/lib/items";
import { Icon } from "./Icon";
import { btnDanger, btnPrimary, btnSecondary, input, select, textarea } from "./ui";

// ------------------------------------------------------------------ types

export type BField = {
  uid: string; // only used inside the builder
  key: string; // stable id once saved ("" for a new field)
  label: string;
  type: string;
  required: boolean;
  masterCanEdit: boolean;
  unit: string;
  options: string; // one choice per line (for a group of boxes: the names of the boxes, one per line)
  sub?: string; // a group of boxes only: "number" or "text"
};
export type BStep = { uid: string; key: string; label: string; photo: string; needs: string[] };

type PaletteItem = { type: string; name: string; hint: string; label: string };

const PALETTE: { group: string; items: PaletteItem[] }[] = [
  {
    group: "Write",
    items: [
      { type: "text", name: "Text box", hint: "One line, like a design number", label: "Text box" },
      { type: "color", name: "Color code", hint: "A HEX color, like #1F69D1", label: "Color code" },
      { type: "number", name: "Number", hint: "A measurement or a number", label: "Number" },
      { type: "group", name: "Group of boxes", hint: "A title with several boxes under it, like Measurements", label: "Measurements" },
    ],
  },
  {
    group: "Pick",
    items: [
      { type: "select", name: "Dropdown list", hint: "Pick one from a list", label: "Dropdown list" },
      { type: "radio", name: "Choose one", hint: "Buttons, pick one", label: "Choose one" },
      { type: "checkboxes", name: "Choose many", hint: "Tick boxes, pick several", label: "Choose many" },
      { type: "yesno", name: "Yes / No", hint: "A simple question", label: "Yes or no?" },
    ],
  },
  {
    group: "Pictures",
    items: [{ type: "picture", name: "Reference picture", hint: "A design or sample photo on the order (not the step photo)", label: "Reference picture" }],
  },
  {
    group: "Text on the form",
    items: [
      { type: "heading", name: "Bold heading", hint: "A bold title for a section", label: "Heading" },
      { type: "note", name: "Note", hint: "A line of instructions", label: "Write a note here" },
    ],
  },
];
const ALL = PALETTE.flatMap((g) => g.items);
const NAME = Object.fromEntries(ALL.map((i) => [i.type, i.name]));
const CHOICE = ["select", "radio", "checkboxes"];
const DISPLAY_ONLY = ["heading", "note"];

/**
 * A group of boxes is only a convenience in the builder: when the form is saved it becomes a bold heading followed by
 * one box for each name (numbers with a unit, or text), so nothing else in the app needs to know about groups.
 */
function expandGroups(rows: BField[]): BField[] {
  return rows.flatMap((f) => {
    if (f.type !== "group") return [f];
    const heading: BField = { uid: f.uid, key: "", label: f.label, type: "heading", required: false, masterCanEdit: false, unit: "", options: "" };
    const boxes = f.options
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name, n): BField => ({
        uid: `${f.uid}-${n}`,
        key: "",
        label: name,
        type: f.sub === "text" ? "text" : "number",
        required: f.required,
        masterCanEdit: f.masterCanEdit,
        unit: f.sub === "text" ? "" : f.unit,
        options: "",
      }));
    return [heading, ...boxes];
  });
}

// ------------------------------------------------------------- palette tile

function Tile({ item, onAdd, lastDragEnd }: { item: PaletteItem; onAdd: (type: string) => void; lastDragEnd: React.RefObject<number> }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${item.type}`,
    data: { from: "palette", type: item.type },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => {
        if (Date.now() - lastDragEnd.current < 350) return; // a drop, not a tap
        onAdd(item.type);
      }}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: "manipulation" }}
      className="flex min-h-14 w-full items-center gap-3 border border-base-300 bg-base-100 px-3 py-2 text-left hover:border-secondary hover:bg-base-200"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-base-200 text-secondary">
        <Icon name={item.type} />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-medium leading-tight">{item.name}</span>
        <span className="block text-sm leading-tight opacity-70">{item.hint}</span>
      </span>
    </button>
  );
}

// ------------------------------------------------------------ a field card

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
      <span className="text-base font-medium">{label}</span>
      <input type="checkbox" className="toggle toggle-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function FieldCard({
  f,
  index,
  count,
  selected,
  onSelect,
  onChange,
  onRemove,
  onMove,
  duplicate,
}: {
  f: BField;
  duplicate: boolean;
  index: number;
  count: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<BField>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.uid });
  const displayOnly = DISPLAY_ONLY.includes(f.type);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={` border bg-base-100 ${selected ? "border-secondary ring-2 ring-secondary/30" : "border-base-300"}`}
    >
      <div className="flex items-center gap-1 p-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${f.label || NAME[f.type]} to move it`}
          className="flex h-12 w-10 shrink-0 cursor-grab touch-none items-center justify-center text-base-content/60 hover:bg-base-200"
        >
          <Icon name="grip" />
        </button>
        <button type="button" onClick={onSelect} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={selected}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-base-200 text-secondary">
            <Icon name={f.type} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate ${f.type === "heading" ? "text-xl font-medium" : f.type === "note" ? "text-base opacity-80" : "text-base font-medium"}`}>
              {f.label || <em className="opacity-60">No name yet</em>}
            </span>
            <span className="flex flex-wrap gap-1 pt-0.5 text-xs font-medium">
              <span className="opacity-60">
                {NAME[f.type]}
                {f.type === "group" && ` - ${f.options.split("\n").filter((x) => x.trim()).length} boxes`}
              </span>
              {duplicate && <span className="rounded bg-error/15 px-1.5 text-error">Same name as another field</span>}
              {f.required && f.type !== "picture" && <span className="rounded bg-error/15 px-1.5 text-error">Warns if empty</span>}
              {f.masterCanEdit && <span className="rounded bg-secondary/15 px-1.5 text-secondary">Master can fill</span>}
            </span>
          </span>
          <Icon name="chevron" className={`h-4 w-4 shrink-0 transition-transform ${selected ? "rotate-180" : ""}`} />
        </button>
      </div>

      {selected && (
        <div className="space-y-3 border-t border-base-300 bg-base-200/50 p-3">
          <label className="block">
            <span className="mb-1 block text-base font-medium">{displayOnly ? "Text to show" : "Field name"}</span>
            {f.type === "note" ? (
              <textarea value={f.label} onChange={(e) => onChange({ label: e.target.value })} rows={3} className={textarea} />
            ) : (
              <input value={f.label} onChange={(e) => onChange({ label: e.target.value })} className={input} autoFocus />
            )}
            {duplicate && <span className="mt-1 block text-sm font-medium text-error">Another field already has this name. Give each field its own name.</span>}
          </label>

          {!displayOnly && (
            <>
              {f.type === "picture" ? (
                <p className="text-sm opacity-70">Pictures are added on the order form. They are not compulsory.</p>
              ) : (
                <>
                  <Toggle label="Warn me if this is left empty" checked={f.required} onChange={(v) => onChange({ required: v })} />
                  <p className="-mt-2 text-sm opacity-70">Only a reminder: you can still save. To make a step wait for it, tick it under Steps.</p>
                </>
              )}
              <Toggle label="The master can fill this in" checked={f.masterCanEdit} onChange={(v) => onChange({ masterCanEdit: v })} />
            </>
          )}

          {f.type === "group" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <span className="block text-base font-medium">Boxes under it</span>
                {f.options.split("\n").map((name, n, all) => (
                  <div key={n} className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) => onChange({ options: all.map((x, i) => (i === n ? e.target.value.replace(/\n/g, " ") : x)).join("\n") })}
                      placeholder={n === 0 ? "For example Length" : "For example Chest"}
                      aria-label={`Box ${n + 1}`}
                      className={input}
                    />
                    <button
                      type="button"
                      onClick={() => onChange({ options: all.filter((_, i) => i !== n).join("\n") })}
                      className={`${btnSecondary} !min-h-12 shrink-0 !px-4`}
                      aria-label={`Remove box ${n + 1}`}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => onChange({ options: `${f.options}\n` })} className={`${btnSecondary} !min-h-12 w-full gap-2`}>
                  <Icon name="plus" /> Add another box
                </button>
              </div>
              <p className="text-sm opacity-70">When you save, the title becomes a bold heading and each box becomes its own field.</p>
            </div>
          )}

          {CHOICE.includes(f.type) && (
            <label className="block">
              <span className="mb-1 block text-base font-medium">Choices (one on each line)</span>
              <textarea value={f.options} onChange={(e) => onChange({ options: e.target.value })} rows={4} className={textarea} placeholder={"Silk\nCotton\nLinen"} />
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={`${btnSecondary} !min-h-12 flex-1`} aria-label="Move up">
              <Icon name="up" /> Up
            </button>
            <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} className={`${btnSecondary} !min-h-12 flex-1`} aria-label="Move down">
              <Icon name="down" /> Down
            </button>
            <button type="button" onClick={onRemove} className={`${btnDanger} !min-h-12 flex-1`} aria-label="Remove this field">
              <Icon name="trash" /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// The drop area for the form. It must be a child of <DndContext>.
function Canvas({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-40 space-y-2 border-2 border-dashed p-3 ${isOver ? "border-secondary bg-secondary/5" : "border-base-300"}`}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------------------- save

function SaveButton({ dirty, duplicates }: { dirty: boolean; duplicates: string[] }) {
  const { pending } = useFormStatus();
  const blocked = duplicates.length > 0;
  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rule-2 bg-paper-2/95 px-4 py-3 shadow-[0_8px_24px_-12px_rgb(27_26_75/0.4)] backdrop-blur">
      {blocked ? (
        <span role="alert" className="min-w-0 flex-1 text-base font-medium text-error">
          Give each field its own name before saving. Used twice: {duplicates.map((d) => `"${d}"`).join(", ")}
        </span>
      ) : (
        <span className="flex items-center gap-2 text-base text-muted">
          <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${dirty ? "bg-amber-500" : "bg-ok"}`} />
          {dirty ? "You have changes that are not saved yet" : "All changes saved"}
        </span>
      )}
      <button disabled={pending || blocked} className={`${btnPrimary} ml-auto px-8`}>
        {pending ? "Saving..." : "Save item"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- builder

export function FormBuilder({
  id,
  initialFields,
  initialSteps,
  workflows = [],
  initialWorkflowId = null,
  action,
}: {
  id: number;
  initialFields: Omit<BField, "uid">[];
  initialSteps: Omit<BStep, "uid">[];
  /** the reusable workflows this item can use for its steps */
  workflows?: { id: number; name: string; steps: { key: string; label: string; photo: string }[] }[];
  initialWorkflowId?: number | null;
  action: (f: FormData) => Promise<void>;
}) {
  const [fields, setFields] = useState<BField[]>(() => initialFields.map((f, i) => ({ ...f, uid: `f${i}` })));
  const [steps, setSteps] = useState<BStep[]>(() => initialSteps.map((s, i) => ({ ...s, uid: `s${i}` })));
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<PaletteItem | null>(null);
  const counter = useRef(1000);
  const lastDragEnd = useRef(0);
  const [workflowId, setWorkflowId] = useState<number | null>(initialWorkflowId);
  const workflow = workflows.find((w) => w.id === workflowId) ?? null;
  const [start] = useState(() => JSON.stringify([initialFields, initialSteps, initialWorkflowId]));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const strip = <T extends { uid: string }>(rows: T[]) => rows.map((r) => {
    const { uid, ...rest } = r;
    void uid;
    return rest;
  });
  const dupes = duplicateFieldNames(expandGroups(fields));
  const dupeNames = new Set(dupes.map((d) => d.toLowerCase()));
  const fieldsJson = JSON.stringify(strip(expandGroups(fields)));
  const stepsJson = JSON.stringify(strip(steps));
  const dirty = JSON.stringify([strip(fields), strip(steps), workflowId]) !== start;

  function add(type: string, at?: number) {
    const item = ALL.find((i) => i.type === type)!;
    const field: BField = {
      uid: `n${counter.current++}`,
      key: "",
      label: item.label,
      type,
      required: false,
      masterCanEdit: false,
      unit: "",
      options: CHOICE.includes(type) ? "Option 1\nOption 2" : type === "group" ? "Length\nChest" : "",
      ...(type === "group" ? { sub: "number", unit: "inch" } : {}),
    };
    setFields((rows) => {
      const next = [...rows];
      next.splice(at === undefined || at < 0 ? next.length : at, 0, field);
      return next;
    });
    setSelected(field.uid);
  }

  const patch = (uid: string, p: Partial<BField>) => setFields((rows) => rows.map((r) => (r.uid === uid ? { ...r, ...p } : r)));
  const remove = (uid: string) => {
    setFields((rows) => rows.filter((r) => r.uid !== uid));
    setSelected(null);
  };
  const move = (uid: string, dir: -1 | 1) =>
    setFields((rows) => {
      const i = rows.findIndex((r) => r.uid === uid);
      return i + dir < 0 || i + dir >= rows.length ? rows : arrayMove(rows, i, i + dir);
    });

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current;
    setDragging(data?.from === "palette" ? (ALL.find((i) => i.type === data.type) ?? null) : null);
  }

  function onDragEnd(e: DragEndEvent) {
    lastDragEnd.current = Date.now();
    setDragging(null);
    const { active, over } = e;
    if (!over) return;
    const data = active.data.current;
    const overIndex = over.id === "canvas" ? -1 : fields.findIndex((f) => f.uid === over.id);
    if (data?.from === "palette") {
      add(String(data.type), overIndex);
    } else if (overIndex >= 0 && active.id !== over.id) {
      const from = fields.findIndex((f) => f.uid === active.id);
      setFields((rows) => arrayMove(rows, from, overIndex));
    }
  }

  // steps (no drag: a short list with up / down)
  const patchStep = (uid: string, p: Partial<BStep>) => setSteps((rows) => rows.map((r) => (r.uid === uid ? { ...r, ...p } : r)));
  // choose a workflow: its steps replace the list (the item keeps its own "must be filled in" ticks for steps with the same key)
  function chooseWorkflow(value: string) {
    const wf = workflows.find((w) => String(w.id) === value) ?? null;
    setWorkflowId(wf ? wf.id : null);
    if (!wf) return; // back to custom steps: the list stays as it is and can be changed
    setSteps((rows) =>
      wf.steps.map((s, i) => ({ uid: `w${i}`, key: s.key, label: s.label, photo: s.photo, needs: rows.find((r) => r.key === s.key)?.needs ?? [] })),
    );
  }
  const moveStep = (i: number, dir: -1 | 1) => setSteps((rows) => (i + dir < 0 || i + dir >= rows.length ? rows : arrayMove(rows, i, i + dir)));

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="fields" value={fieldsJson} />
      <input type="hidden" name="stages" value={stepsJson} />
      <input type="hidden" name="workflowId" value={workflowId ?? ""} />

      <DndContext id="form-builder" sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* the form being built */}
          <section aria-label="The form" className="space-y-3">
            <div>
              <h2 className="text-2xl font-medium">The form</h2>
              <p className="text-base opacity-80">
                Drag a field from the list into the form, or tap it to add it at the bottom. Drag the dots to change the order. Tap a field to change its settings.
              </p>
            </div>

            <Canvas>
              <SortableContext items={fields.map((f) => f.uid)} strategy={verticalListSortingStrategy}>
                {fields.map((f, i) => (
                  <FieldCard
                    key={f.uid}
                    f={f}
                    index={i}
                    count={fields.length}
                    selected={selected === f.uid}
                    onSelect={() => setSelected(selected === f.uid ? null : f.uid)}
                    onChange={(p) => patch(f.uid, p)}
                    onRemove={() => remove(f.uid)}
                    onMove={(d) => move(f.uid, d)}
                    duplicate={dupeNames.has(f.label.trim().toLowerCase()) && !DISPLAY_ONLY.includes(f.type) && f.type !== "group"}
                  />
                ))}
              </SortableContext>
              {fields.length === 0 && (
                <p className="flex min-h-32 items-center justify-center text-center text-lg opacity-70">
                  This form is empty. Drag a field here, or tap one in the list.
                </p>
              )}
            </Canvas>
          </section>

          {/* the field list (palette) */}
          <aside aria-label="Fields you can add" className="order-first space-y-4 lg:sticky lg:top-4 lg:order-none lg:self-start">
            <div className="panel space-y-4">
              <h2 className="text-xl font-medium">Add a field</h2>
              {PALETTE.map((g) => (
                <div key={g.group} className="space-y-2">
                  <p className="text-sm font-medium opacity-60">{g.group}</p>
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {g.items.map((item) => (
                      <Tile key={item.type} item={item} onAdd={(t) => add(t)} lastDragEnd={lastDragEnd} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="flex min-h-14 items-center gap-3 border border-secondary bg-base-100 px-3 py-2 shadow-lg">
              <span className="flex h-9 w-9 items-center justify-center bg-base-200 text-secondary">
                <Icon name={dragging.type} />
              </span>
              <span className="text-base font-medium">{dragging.name}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* steps */}
      <section aria-label="Steps" className="space-y-3">
        <div className="space-y-3">
          <h2 className="text-2xl font-medium">Steps</h2>
          <label className="block">
            <span className="mb-1 block text-base font-medium">Workflow</span>
            <select value={workflowId ?? ""} onChange={(e) => chooseWorkflow(e.target.value)} className={select} aria-label="Workflow">
              <option value="">Custom steps (only for this item)</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          {workflow ? (
            <p className="rounded-2xl bg-accent-soft px-4 py-3 text-base">
              These steps come from the workflow <b>{workflow.name}</b>. To change the steps themselves, edit the workflow (it changes every item that uses it), or choose Custom steps.{" "}
              <Link href={`/admin/workflows/${workflow.id}`} className="link font-medium">
                Edit the workflow
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted">
              These steps are only for this item. To use the same steps on other items, <Link href="/admin/workflows/new" className="link">make a workflow</Link>, or save these steps as one below the form.
            </p>
          )}
          <p className="text-base opacity-80">
            The steps this item goes through, in order. A step can wait for two different things. The <b>photo of the work</b> is sent by the master from the phone and you approve it. A <b>field</b> is something on the form above that must be filled in first.
          </p>
        </div>
        {steps.map((s, i) => (
          <div key={s.uid} className="panel space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]">
              <input value={s.label} onChange={(e) => patchStep(s.uid, { label: e.target.value })} placeholder="Step name (e.g. Embroidery)" className={input} aria-label={`Step ${i + 1} name`} disabled={!!workflow} />
              <select value={s.photo} onChange={(e) => patchStep(s.uid, { photo: e.target.value })} className={select} aria-label="Work photo (the master sends it, you approve it)" disabled={!!workflow}>
                <option value="none">No work photo</option>
                <option value="optional">Work photo: optional</option>
                <option value="upload">Work photo: must add one (no approval)</option>
                <option value="required">Work photo: required, you approve it</option>
              </select>
            </div>
            {!workflow && (
              <div className="flex gap-2">
                <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} className={`${btnSecondary} !min-h-12 flex-1`} aria-label="Move step up">
                  <Icon name="up" /> Up
                </button>
                <button type="button" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className={`${btnSecondary} !min-h-12 flex-1`} aria-label="Move step down">
                  <Icon name="down" /> Down
                </button>
                <button type="button" onClick={() => setSteps((rows) => rows.filter((r) => r.uid !== s.uid))} className={`${btnDanger} !min-h-12 flex-1`} aria-label="Remove step">
                  <Icon name="trash" /> Remove
                </button>
              </div>
            )}
          </div>
        ))}
        {!workflow && (
          <button
            type="button"
            onClick={() => setSteps((rows) => [...rows, { uid: `t${counter.current++}`, key: "", label: "", photo: "none", needs: [] }])}
            className={btnSecondary}
          >
            <Icon name="plus" /> Add a step
          </button>
        )}
      </section>

      <SaveButton dirty={dirty} duplicates={dupes} />
    </form>
  );
}

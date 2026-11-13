import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { isAuto, isDisplayOnly, parseOptions } from "./items";
import {
  categories,
  templates,
  workflows,
  FIELD_TYPES,
  SLIP_STYLES,
  PHOTO_RULES,
  type FieldDef,
  type FieldType,
  type PhotoRule,
  type PrintLayout,
  type SlipStyle,
  type StageDef,
} from "@/db/schema";

// ------------------------------------------------------------ categories

/** One place after the last one, so a new category goes to the end of the list. */
function nextPosition(parentId: number | null) {
  const rows = db.select({ p: categories.position, parentId: categories.parentId }).from(categories).all();
  return Math.max(0, ...rows.filter((r) => r.parentId === parentId).map((r) => r.p)) + 1;
}

export function createMainCategory(name: string, colour: string) {
  return db
    .insert(categories)
    .values({ name, colour, parentId: null, position: nextPosition(null) })
    .returning({ id: categories.id })
    .get().id;
}

/** Saves the order of the categories inside one group (or of the groups when parentId is null). */
export function reorderCategories(parentId: number | null, ids: number[]) {
  db.transaction((tx) => {
    const own = new Set(
      tx.select({ id: categories.id, parentId: categories.parentId }).from(categories).all().filter((c) => c.parentId === parentId).map((c) => c.id),
    );
    ids.filter((id) => own.has(id)).forEach((id, i) => tx.update(categories).set({ position: i + 1 }).where(eq(categories.id, id)).run());
  });
}

/** Creating a sub-category also creates its (empty) template. */
export function createSubCategory(parentId: number, name: string, colour: string) {
  return db.transaction((tx) => {
    const id = tx.insert(categories).values({ name, colour, parentId, position: nextPosition(parentId) }).returning({ id: categories.id }).get().id;
    tx.insert(templates).values({ categoryId: id, fields: [], stages: [] }).run();
    return id;
  });
}

/** The form (template) of a sub-category. */
export function templateIdOf(categoryId: number): number | null {
  return db.select({ id: templates.id }).from(templates).where(eq(templates.categoryId, categoryId)).get()?.id ?? null;
}

/** A copy of one item (same group) with its form, steps and saved steps. Returns the new sub-category id. */
function copySub(subId: number, parentId: number, name: string): number {
  const sub = db.select().from(categories).where(eq(categories.id, subId)).get();
  const tpl = db.select().from(templates).where(eq(templates.categoryId, subId)).get();
  if (!sub) throw new Error("item not found");
  const id = db.insert(categories).values({ name, colour: sub.colour, parentId, position: nextPosition(parentId) }).returning({ id: categories.id }).get().id;
  db.insert(templates)
    .values({ categoryId: id, fields: tpl?.fields ?? [], stages: tpl?.stages ?? [], workflowId: tpl?.workflowId ?? null, printLayout: tpl?.printLayout ?? null })
    .run();
  return id;
}

/** Copy one item next to the original, named "<name> copy". */
export function copyItem(subId: number): number | null {
  const sub = db.select().from(categories).where(eq(categories.id, subId)).get();
  if (!sub?.parentId) return null;
  return db.transaction(() => copySub(subId, sub.parentId!, `${sub.name} copy`));
}

/** Copy a whole group with all its items (forms and steps), named "<name> copy". Returns the new group id. */
export function copyGroup(mainId: number): number | null {
  const main = db.select().from(categories).where(eq(categories.id, mainId)).get();
  if (!main || main.parentId !== null) return null;
  return db.transaction(() => {
    const id = createMainCategory(`${main.name} copy`, main.colour);
    const subs = db.select().from(categories).where(eq(categories.parentId, mainId)).orderBy(categories.position, categories.name).all();
    for (const s of subs) copySub(s.id, id, s.name);
    return id;
  });
}

export function updateCategory(id: number, name: string, colour: string) {
  db.update(categories).set({ name, colour }).where(eq(categories.id, id)).run();
}

/** Deletes a category (and, for a main category, its sub-categories and templates). Old orders keep their snapshots. */
export function deleteCategory(id: number) {
  db.transaction((tx) => {
    const subs = tx.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id)).all();
    const ids = [id, ...subs.map((s) => s.id)];
    tx.delete(templates).where(inArray(templates.categoryId, ids)).run();
    tx.delete(categories).where(inArray(categories.id, ids)).run();
  });
}

export function listCategoryTree() {
  const all = db.select().from(categories).orderBy(categories.position, categories.name).all();
  const tpl = db.select().from(templates).all();
  const tplByCat = new Map(tpl.map((t) => [t.categoryId, t]));
  return all
    .filter((c) => c.parentId === null)
    .map((main) => ({
      ...main,
      subs: all
        .filter((c) => c.parentId === main.id)
        .map((sub) => ({ ...sub, template: tplByCat.get(sub.id)! })),
    }));
}

// ------------------------------------------------------------- templates

export function getTemplate(id: number) {
  const t = db.select().from(templates).where(eq(templates.id, id)).get();
  if (!t) return null;
  const sub = db.select().from(categories).where(eq(categories.id, t.categoryId)).get();
  const main = sub?.parentId ? db.select().from(categories).where(eq(categories.id, sub.parentId)).get() : null;
  if (!sub) return null;
  return { ...t, sub, main };
}

/** Everything needed to turn a template into an order item. */
export function templateForItem(id: number) {
  const t = getTemplate(id);
  if (!t) return null;
  return {
    id: t.id,
    snapshot: {
      templateName: t.sub.name,
      path: t.main ? `${t.main.name} > ${t.sub.name}` : t.sub.name,
      colour: t.sub.colour,
      version: t.version,
      fields: t.fields,
      stages: t.stages,
      ...(t.printLayout ? { print: t.printLayout } : {}),
    },
  };
}

/** For the "tick the items" picker: active templates grouped by main category. */
export function pickerGroups() {
  return listCategoryTree()
    .map((m) => ({ id: m.id, name: m.name, items: m.subs.map((s) => ({ templateId: s.template.id, name: s.name, colour: s.colour })) }))
    .filter((g) => g.items.length > 0);
}

/** Keys of the fields a step is allowed to require: real input fields (not headings or notes), already saved. */
function requirableKeys(fields: FieldDef[]): Set<string> {
  return new Set(fields.filter((f) => f.type !== "heading" && f.type !== "note").map((f) => f.key));
}

/** Drop required-field keys that no longer exist in the form, so a deleted field can never block a step. */
export function cleanStageRequirements(fields: FieldDef[], stages: StageDef[]): StageDef[] {
  const ok = requirableKeys(fields);
  return stages.map((s) => {
    const { requiresFields, ...rest } = s;
    const keep = (requiresFields ?? []).filter((k) => ok.has(k));
    return keep.length ? { ...rest, requiresFields: keep } : rest;
  });
}

/**
 * The steps a workflow gives one item type: the workflow's steps, keeping the "must be filled in" ticks this item type
 * already had for the same step (those belong to the item's own form, not to the workflow).
 */
export function stagesFromWorkflow(workflowStages: StageDef[], current: StageDef[], fields: FieldDef[]): StageDef[] {
  const needs = new Map(current.map((s) => [s.key, s.requiresFields]));
  const merged = workflowStages.map((s) => {
    const { requiresFields, ...rest } = s;
    void requiresFields;
    const keep = needs.get(s.key);
    return keep?.length ? { ...rest, requiresFields: keep } : rest;
  });
  return cleanStageRequirements(fields, merged);
}

/**
 * Save an item type's form and steps. `workflowId`: a number = use that workflow (its steps win; only the "must be
 * filled in" ticks of `rawStages` are kept); null = the item's own custom steps; left out = keep the link it has.
 */
/** The boxes that can go on the karigar paper: text and number boxes of the form (not automatic ones, not long writing), by key. */
export function karigarFieldKeys(fields: FieldDef[]): Set<string> {
  return new Set(fields.filter((f) => (f.type === "text" || f.type === "number") && f.key).map((f) => f.key));
}

/** What the builder sent for "Printed slips", made safe: a known style, and rows holding each existing box once. */
export function cleanPrintLayout(raw: unknown, fields: FieldDef[]): PrintLayout {
  const o = (raw && typeof raw === "object" ? raw : {}) as { slip?: unknown; karigarRows?: unknown };
  const slip = (SLIP_STYLES as readonly string[]).includes(o.slip as string) ? (o.slip as SlipStyle) : "tailor";
  const ok = karigarFieldKeys(fields);
  const seen = new Set<string>();
  const rows: string[][] = [];
  for (const row of Array.isArray(o.karigarRows) ? o.karigarRows.slice(0, 12) : []) {
    if (!Array.isArray(row)) continue;
    const keys: string[] = [];
    for (const k of row) {
      if (typeof k === "string" && ok.has(k) && !seen.has(k) && keys.length < 10) {
        seen.add(k); // each box once, in the whole layout
        keys.push(k);
      }
    }
    if (keys.length) rows.push(keys);
  }
  return rows.length ? { slip, karigarRows: rows } : { slip };
}

export function saveTemplate(id: number, fields: FieldDef[], rawStages: StageDef[], workflowId?: number | null, rawPrint?: unknown) {
  const old = db.select().from(templates).where(eq(templates.id, id)).get();
  if (!old) return;
  const link = workflowId === undefined ? old.workflowId : workflowId;
  const wf = link ? db.select().from(workflows).where(eq(workflows.id, link)).get() : null;
  const stages = wf ? stagesFromWorkflow(wf.stages, rawStages, fields) : cleanStageRequirements(fields, rawStages);
  const newLink = wf ? wf.id : null;
  // the print layout: left out = keep what is saved; the tailor slip only is the default and is stored as nothing
  const print = rawPrint === undefined ? old.printLayout : (() => { const p = cleanPrintLayout(rawPrint, fields); return p.slip === "tailor" && !p.karigarRows ? null : p; })();
  const changed = JSON.stringify([old.fields, old.stages, old.workflowId]) !== JSON.stringify([fields, stages, newLink]);
  db.update(templates)
    .set({ fields, stages, workflowId: newLink, printLayout: print ?? null, version: changed ? old.version + 1 : old.version, updatedAt: new Date() })
    .where(eq(templates.id, id))
    .run();
}

/** Save only the fields (stages and workflow unchanged). */
export function saveTemplateFields(id: number, fields: FieldDef[]) {
  const old = db.select().from(templates).where(eq(templates.id, id)).get();
  if (old) saveTemplate(id, fields, old.stages, old.workflowId);
}

// ------------------------------------------------------- builder parsing

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "field";

/** Pick a key that isn't used yet. Existing keys never change. */
export function uniqueKey(label: string, used: Set<string>): string {
  const base = slug(label);
  let key = base;
  for (let i = 2; used.has(key); i++) key = `${base}_${i}`;
  used.add(key);
  return key;
}

export type BuilderRow = {
  key: string;
  label: string;
  type: string;
  required: string;
  unit: string;
  options?: string; // one choice per line
  who?: string; // "master" = the master can fill / change it
  pictures?: boolean; // pictures can be added under it (text, long text and number)
  short?: string; // short name for the tailor slip
  perRow?: number | string; // a heading: boxes in one printed row
  newRow?: boolean; // a text or number box starts a new printed row
};

/** Turn submitted builder rows into field definitions. Rows with no label are dropped. */
export function rowsToFields(rows: BuilderRow[]): FieldDef[] {
  const used = new Set(rows.map((r) => r.key).filter(Boolean));
  const out: FieldDef[] = [];
  for (const r of rows) {
    const label = r.label.trim();
    if (!label) continue;
    const type = (FIELD_TYPES as readonly string[]).includes(r.type) ? (r.type as FieldType) : "text";
    const def: FieldDef = {
      key: r.key || uniqueKey(label, used),
      label,
      type,
      required: r.required === "required" && !isDisplayOnly({ type }) && !isAuto({ type }),
    };
    const unit = (r.unit ?? "").trim();
    if (unit && type === "number") def.unit = unit;
    if (type === "select" || type === "radio" || type === "checkboxes") def.options = parseOptions(r.options ?? "");
    if (r.who === "master" && !isDisplayOnly({ type }) && !isAuto({ type })) def.masterCanEdit = true;
    if (r.pictures === true && (type === "text" || type === "longtext" || type === "number")) def.pictures = true;
    const short = (r.short ?? "").trim().slice(0, 12);
    if (short && (type === "text" || type === "number")) def.short = short;
    const per = Number(r.perRow);
    if (type === "heading" && Number.isInteger(per) && per >= 1 && per <= 10) def.perRow = per;
    if (r.newRow === true && (type === "text" || type === "number")) def.newRow = true;
    out.push(def);
  }
  return out;
}

export type StageRow = { key: string; label: string; photo: string; requires?: string[]; days?: number | string };

/** "5" / 5 -> 5; anything that is not a whole number of days from 1 to 365 -> undefined (no target). */
export function cleanDays(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : undefined;
}

/** Turn submitted stage rows into stage definitions. Rows with no label are dropped. */
export function rowsToStages(rows: StageRow[]): StageDef[] {
  const used = new Set(rows.map((r) => r.key).filter(Boolean));
  const out: StageDef[] = [];
  for (const r of rows) {
    const label = r.label.trim();
    if (!label) continue;
    const photo = (PHOTO_RULES as readonly string[]).includes(r.photo) ? (r.photo as PhotoRule) : "none";
    const requiresFields = [...new Set((r.requires ?? []).filter((k) => typeof k === "string" && k))];
    const days = cleanDays(r.days);
    out.push({ key: r.key || uniqueKey(label, used), label, photo, ...(days ? { days } : {}), ...(requiresFields.length ? { requiresFields } : {}) });
  }
  return out;
}

// ---------------------------------------------------- drag-and-drop builder

/** What the drag-and-drop builder sends for one field. */
export type BuilderField = {
  key?: string;
  label?: string;
  type?: string;
  required?: boolean;
  masterCanEdit?: boolean;
  pictures?: boolean;
  short?: string;
  perRow?: number | string;
  newRow?: boolean;
  unit?: string;
  options?: string; // one choice per line
};
export type BuilderStep = { key?: string; label?: string; photo?: string; needs?: unknown; days?: unknown };

const asList = (json: string, max: number): unknown[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.slice(0, max) : [];
  } catch {
    return [];
  }
};
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Fields from the builder's JSON. Anything unknown is dropped or fixed by rowsToFields. */
export function fieldsFromBuilder(json: string): FieldDef[] {
  return rowsToFields(
    (asList(json, 200) as BuilderField[]).map((f) => ({
      key: str(f?.key),
      label: str(f?.label),
      type: str(f?.type),
      required: f?.required === true ? "required" : "optional",
      unit: str(f?.unit),
      options: str(f?.options),
      who: f?.masterCanEdit === true ? "master" : "admin",
      pictures: f?.pictures === true,
      short: str(f?.short),
      perRow: f?.perRow,
      newRow: f?.newRow === true,
    })),
  );
}

export function stagesFromBuilder(json: string): StageDef[] {
  return rowsToStages((asList(json, 50) as BuilderStep[]).map((s) => ({
      key: str(s?.key),
      label: str(s?.label),
      photo: str(s?.photo),
      days: s?.days as number | string | undefined,
      requires: Array.isArray(s?.needs) ? s.needs.filter((k): k is string => typeof k === "string") : [],
    })));
}

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { isDisplayOnly, parseOptions } from "./items";
import {
  categories,
  templates,
  FIELD_TYPES,
  PHOTO_RULES,
  type FieldDef,
  type FieldType,
  type PhotoRule,
  type StageDef,
} from "@/db/schema";

// ------------------------------------------------------------ categories

export function createMainCategory(name: string, colour: string) {
  return db.insert(categories).values({ name, colour, parentId: null }).returning({ id: categories.id }).get().id;
}

/** Creating a sub-category also creates its (empty) template. */
export function createSubCategory(parentId: number, name: string, colour: string) {
  return db.transaction((tx) => {
    const id = tx.insert(categories).values({ name, colour, parentId }).returning({ id: categories.id }).get().id;
    tx.insert(templates).values({ categoryId: id, fields: [], stages: [] }).run();
    return id;
  });
}

/** The form (template) of a sub-category. */
export function templateIdOf(categoryId: number): number | null {
  return db.select({ id: templates.id }).from(templates).where(eq(templates.categoryId, categoryId)).get()?.id ?? null;
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
  const all = db.select().from(categories).orderBy(categories.name).all();
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

export function saveTemplate(id: number, fields: FieldDef[], rawStages: StageDef[]) {
  const stages = cleanStageRequirements(fields, rawStages);
  const old = db.select().from(templates).where(eq(templates.id, id)).get();
  if (!old) return;
  const changed = JSON.stringify([old.fields, old.stages]) !== JSON.stringify([fields, stages]);
  db.update(templates)
    .set({ fields, stages, version: changed ? old.version + 1 : old.version, updatedAt: new Date() })
    .where(eq(templates.id, id))
    .run();
}

/** Save only the fields (stages unchanged). */
export function saveTemplateFields(id: number, fields: FieldDef[]) {
  const old = db.select().from(templates).where(eq(templates.id, id)).get();
  if (old) saveTemplate(id, fields, old.stages);
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
      required: r.required === "required" && !isDisplayOnly({ type }),
    };
    const unit = (r.unit ?? "").trim();
    if (unit && type === "number") def.unit = unit;
    if (type === "select" || type === "radio" || type === "checkboxes") def.options = parseOptions(r.options ?? "");
    if (r.who === "master" && !isDisplayOnly({ type })) def.masterCanEdit = true;
    out.push(def);
  }
  return out;
}

export type StageRow = { key: string; label: string; photo: string; requires?: string[] };

/** Turn submitted stage rows into stage definitions. Rows with no label are dropped. */
export function rowsToStages(rows: StageRow[]): StageDef[] {
  const used = new Set(rows.map((r) => r.key).filter(Boolean));
  const out: StageDef[] = [];
  for (const r of rows) {
    const label = r.label.trim();
    if (!label) continue;
    const photo = (PHOTO_RULES as readonly string[]).includes(r.photo) ? (r.photo as PhotoRule) : "none";
    const requiresFields = [...new Set((r.requires ?? []).filter((k) => typeof k === "string" && k))];
    out.push({ key: r.key || uniqueKey(label, used), label, photo, ...(requiresFields.length ? { requiresFields } : {}) });
  }
  return out;
}

/** Item types with the same print group name print on one shared page. Empty = own page. */
export function setPrintGroup(id: number, name: string) {
  db.update(templates)
    .set({ printGroup: name.trim() || null })
    .where(eq(templates.id, id))
    .run();
}

// ---------------------------------------------------- drag-and-drop builder

/** What the drag-and-drop builder sends for one field. */
export type BuilderField = {
  key?: string;
  label?: string;
  type?: string;
  required?: boolean;
  masterCanEdit?: boolean;
  unit?: string;
  options?: string; // one choice per line
};
export type BuilderStep = { key?: string; label?: string; photo?: string; needs?: unknown };

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
    })),
  );
}

export function stagesFromBuilder(json: string): StageDef[] {
  return rowsToStages((asList(json, 50) as BuilderStep[]).map((s) => ({
      key: str(s?.key),
      label: str(s?.label),
      photo: str(s?.photo),
      requires: Array.isArray(s?.needs) ? s.needs.filter((k): k is string => typeof k === "string") : [],
    })));
}

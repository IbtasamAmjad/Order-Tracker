import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, templates, workflows, type StageDef } from "@/db/schema";
import { rowsToStages, stagesFromWorkflow, type StageRow } from "./templates";

/** The steps of a workflow: a name and a photo rule for each. (Which form fields a step waits for belongs to each item type.) */
export function cleanWorkflowStages(rows: StageRow[]): StageDef[] {
  return rowsToStages(rows.map((r) => ({ key: r.key, label: r.label, photo: r.photo }))).map((s) => ({ key: s.key, label: s.label, photo: s.photo }));
}

export type WorkflowView = {
  id: number;
  name: string;
  stages: StageDef[];
  usedBy: { templateId: number; name: string }[]; // the item types that use it
};

/** Every workflow with the item types that use it. */
export function listWorkflows(): WorkflowView[] {
  const all = db.select().from(workflows).orderBy(asc(workflows.name)).all();
  const used = db
    .select({ templateId: templates.id, workflowId: templates.workflowId, name: categories.name })
    .from(templates)
    .innerJoin(categories, eq(templates.categoryId, categories.id))
    .all();
  return all.map((w) => ({
    id: w.id,
    name: w.name,
    stages: w.stages,
    usedBy: used.filter((u) => u.workflowId === w.id).map((u) => ({ templateId: u.templateId, name: u.name })).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

export function getWorkflow(id: number): WorkflowView | null {
  return listWorkflows().find((w) => w.id === id) ?? null;
}

/** Why a workflow cannot be saved with this name, or null. Names are used once. */
export function checkWorkflowName(name: string, ownId?: number): string | null {
  const n = name.trim();
  if (!n) return "Give the steps a name.";
  const clash = db.select().from(workflows).all().find((w) => w.name.trim().toLowerCase() === n.toLowerCase() && w.id !== ownId);
  return clash ? `There is already a workflow called ${clash.name}.` : null;
}

/** Give an item type the steps of a workflow (keeping the item's own "must be filled in" ticks for steps with the same key). */
function applyTo(templateId: number, wf: { id: number; stages: StageDef[] }) {
  const t = db.select().from(templates).where(eq(templates.id, templateId)).get();
  if (!t) return;
  const stages = stagesFromWorkflow(wf.stages, t.stages, t.fields);
  const changed = JSON.stringify([t.stages, t.workflowId]) !== JSON.stringify([stages, wf.id]);
  db.update(templates)
    .set({ stages, workflowId: wf.id, version: changed ? t.version + 1 : t.version, updatedAt: new Date() })
    .where(eq(templates.id, templateId))
    .run();
}

export function createWorkflow(name: string, rows: StageRow[]): number {
  const bad = checkWorkflowName(name);
  if (bad) throw new Error(bad);
  return db.insert(workflows).values({ name: name.trim(), stages: cleanWorkflowStages(rows) }).returning({ id: workflows.id }).get().id;
}

/** Change a workflow. Every item type that uses it gets the new steps, for new customers; customers already made keep theirs. */
export function updateWorkflow(id: number, name: string, rows: StageRow[]): void {
  const bad = checkWorkflowName(name, id);
  if (bad) throw new Error(bad);
  db.transaction(() => {
    const stages = cleanWorkflowStages(rows);
    db.update(workflows).set({ name: name.trim(), stages, updatedAt: new Date() }).where(eq(workflows.id, id)).run();
    for (const t of db.select({ id: templates.id }).from(templates).where(eq(templates.workflowId, id)).all()) applyTo(t.id, { id, stages });
  });
}

/** Delete a workflow. The item types that used it keep their steps as their own custom steps. */
export function deleteWorkflow(id: number): void {
  db.transaction(() => {
    db.update(templates).set({ workflowId: null }).where(eq(templates.workflowId, id)).run();
    db.delete(workflows).where(eq(workflows.id, id)).run();
  });
}

/** Use a workflow for an item type, or (workflowId null) go back to its own custom steps. */
export function assignWorkflow(templateId: number, workflowId: number | null): void {
  if (workflowId === null) {
    db.update(templates).set({ workflowId: null }).where(eq(templates.id, templateId)).run();
    return;
  }
  const wf = db.select().from(workflows).where(eq(workflows.id, workflowId)).get();
  if (wf) applyTo(templateId, wf);
}

/** Make a reusable workflow from an item type's current steps, and let that item type use it. */
export function workflowFromTemplate(templateId: number, name: string): number {
  const t = db.select().from(templates).where(eq(templates.id, templateId)).get();
  if (!t) throw new Error("That item was not found.");
  const id = createWorkflow(name, t.stages.map((s) => ({ key: s.key, label: s.label, photo: s.photo })));
  assignWorkflow(templateId, id);
  return id;
}

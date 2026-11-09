"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { stagesFromBuilder } from "@/lib/templates";
import { createWorkflow, deleteWorkflow, updateWorkflow, workflowFromTemplate } from "@/lib/workflows";

export type WorkflowFormState = { error?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Save a workflow from its editor (a new one when there is no id). Says what is wrong instead of losing the steps. */
export async function saveWorkflowAction(_prev: WorkflowFormState, f: FormData): Promise<WorkflowFormState> {
  await requireAdmin();
  const id = Number(f.get("id")) || 0;
  const rows = stagesFromBuilder(String(f.get("stages") ?? "[]"));
  if (rows.length === 0) return { error: "Add at least one step." };
  try {
    if (id) updateWorkflow(id, str(f, "name"), rows);
    else createWorkflow(str(f, "name"), rows);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/workflows?saved=1");
}

export async function deleteWorkflowAction(f: FormData) {
  await requireAdmin();
  deleteWorkflow(Number(f.get("id")));
  revalidatePath("/admin", "layout");
  redirect("/admin/workflows?deleted=1");
}

/** From an item's builder: make a reusable workflow from the item's saved steps, and let the item use it. */
export async function saveStepsAsWorkflowAction(f: FormData) {
  await requireAdmin();
  const templateId = Number(f.get("templateId"));
  try {
    workflowFromTemplate(templateId, str(f, "name"));
  } catch (e) {
    redirect(`/admin/templates/${templateId}?wfError=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/templates/${templateId}?wf=made`);
}

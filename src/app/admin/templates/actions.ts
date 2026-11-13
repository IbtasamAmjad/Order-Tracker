"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { syncActiveItems } from "@/lib/item-sync";
import { duplicateFieldNames } from "@/lib/items";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMainCategory,
  copyGroup,
  copyItem,
  createSubCategory,
  deleteCategory,
  fieldsFromBuilder,
  reorderCategories,
  saveTemplate,
  stagesFromBuilder,
  templateIdOf,
  updateCategory,
} from "@/lib/templates";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const colourOf = (f: FormData) => (/^#[0-9a-fA-F]{6}$/.test(str(f, "colour")) ? str(f, "colour") : "#64748b");

export async function createMainAction(f: FormData) {
  await requireAdmin();
  revalidatePath("/admin", "layout");
  const name = str(f, "name");
  if (name) createMainCategory(name, colourOf(f));
  redirect("/admin/templates");
}

export async function createSubAction(f: FormData) {
  await requireAdmin();
  revalidatePath("/admin", "layout");
  const name = str(f, "name");
  const parentId = Number(f.get("parentId"));
  if (name && parentId) {
    const templateId = templateIdOf(createSubCategory(parentId, name, colourOf(f)));
    if (templateId) redirect(`/admin/templates/${templateId}`);
  }
  redirect("/admin/templates");
}

export async function reorderCategoriesAction(parentId: number | null, ids: number[]) {
  await requireAdmin();
  reorderCategories(parentId, ids.map(Number).filter(Number.isInteger));
  revalidatePath("/admin", "layout");
}

export async function updateCategoryAction(f: FormData) {
  await requireAdmin();
  revalidatePath("/admin", "layout");
  const name = str(f, "name");
  if (name) updateCategory(Number(f.get("id")), name, colourOf(f));
  const back = str(f, "back");
  redirect(back.startsWith("/admin/") ? back : "/admin/templates");
}

export async function deleteCategoryAction(f: FormData) {
  await requireAdmin();
  revalidatePath("/admin", "layout");
  deleteCategory(Number(f.get("id")));
  redirect("/admin/templates");
}

/** Save the category from the drag-and-drop builder (fields and steps arrive as JSON). */
export async function saveCategoryAction(f: FormData) {
  await requireAdmin();
  revalidatePath("/admin", "layout");
  const id = Number(f.get("id"));
  const fields = fieldsFromBuilder(String(f.get("fields") ?? "[]"));
  if (duplicateFieldNames(fields).length > 0) redirect(`/admin/templates/${id}?e=duplicate`);
  const workflowId = Number(f.get("workflowId")) || null; // empty = the item's own custom steps
  let print: unknown;
  try {
    print = f.has("printLayout") ? JSON.parse(String(f.get("printLayout"))) : undefined;
  } catch {
    print = undefined;
  }
  saveTemplate(id, fields, stagesFromBuilder(String(f.get("stages") ?? "[]")), workflowId, print);
  const updated = syncActiveItems({ templateId: id }); // customers already in progress get the change too, nobody has to press a button
  redirect(`/admin/templates/${id}?saved=1${updated > 0 ? `&synced=${updated}` : ""}`);
}

/** Make a copy of an item (its form and steps) in the same group, then open the copy. */
export async function copyItemAction(f: FormData) {
  await requireAdmin();
  revalidatePath("/admin", "layout");
  const newId = copyItem(Number(f.get("id")));
  const templateId = newId ? templateIdOf(newId) : null;
  redirect(templateId ? `/admin/templates/${templateId}?copied=1` : "/admin/templates");
}

/** Make a copy of a whole group with all its items. */
export async function copyGroupAction(f: FormData) {
  await requireAdmin();
  revalidatePath("/admin", "layout");
  copyGroup(Number(f.get("id")));
  redirect("/admin/templates");
}

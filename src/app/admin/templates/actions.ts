"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMainCategory,
  createSubCategory,
  deleteCategory,
  fieldsFromBuilder,
  saveTemplate,
  setPrintGroup,
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
  saveTemplate(id, fieldsFromBuilder(String(f.get("fields") ?? "[]")), stagesFromBuilder(String(f.get("stages") ?? "[]")));
  redirect(`/admin/templates/${id}?saved=1`);
}

export async function setPrintGroupAction(f: FormData) {
  await requireAdmin();
  const id = Number(f.get("id"));
  setPrintGroup(id, str(f, "printGroup"));
  redirect(`/admin/templates/${id}`);
}

/** The "New category" page: pick an existing group or type a new one, name the category, then go build its form. */
export async function createCategoryAction(f: FormData) {
  await requireAdmin();
  revalidatePath("/admin", "layout");
  const name = str(f, "name");
  const colour = colourOf(f);
  const newGroup = str(f, "newGroup");
  let parentId = Number(f.get("parentId")) || 0;
  if (newGroup) parentId = createMainCategory(newGroup, colour);
  if (!name || !parentId) redirect("/admin/templates/new?e=missing");
  const templateId = templateIdOf(createSubCategory(parentId, name, colour));
  redirect(templateId ? `/admin/templates/${templateId}` : "/admin/templates");
}

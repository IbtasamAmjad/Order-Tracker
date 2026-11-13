"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { addDesignPictures, createDesign, getDesign, removeDesignPicture, updateDesign } from "@/lib/designs";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const files = (f: FormData, k: string) => f.getAll(k).filter((x): x is File => x instanceof File);

/** Adds a design to the library with its pictures. */
export async function createDesignAction(f: FormData) {
  await requireAdmin();
  let id: number;
  try {
    id = createDesign({ name: str(f, "name"), notes: str(f, "notes") });
  } catch (e) {
    redirect(`/admin/designs?e=${encodeURIComponent((e as Error).message)}`);
  }
  await addDesignPictures(id, files(f, "pics"));
  redirect(`/admin/designs?added=${id}`);
}

/** Saves the name, item type and notes of a design and adds the pictures chosen. */
export async function saveDesignAction(f: FormData) {
  await requireAdmin();
  const id = Number(f.get("id"));
  try {
    updateDesign(id, { name: str(f, "name"), notes: str(f, "notes") });
  } catch (e) {
    redirect(`/admin/designs/${id}?e=${encodeURIComponent((e as Error).message)}`);
  }
  await addDesignPictures(id, files(f, "pics"));
  revalidatePath("/admin/designs");
  redirect(`/admin/designs/${id}?saved=1`);
}

export async function removeDesignPictureAction(f: FormData) {
  await requireAdmin();
  const id = Number(f.get("id"));
  await removeDesignPicture(id, Number(f.get("photoId")));
  revalidatePath(`/admin/designs/${id}`);
  redirect(`/admin/designs/${id}`);
}

/** Hides a design from the picker on the customer form (or shows it again). Designs are never deleted. */
export async function setDesignActiveAction(f: FormData) {
  await requireAdmin();
  const id = Number(f.get("id"));
  const d = getDesign(id);
  if (d) updateDesign(id, { name: d.name, notes: d.notes, active: f.get("active") === "1" });
  redirect(`/admin/designs/${id}`);
}

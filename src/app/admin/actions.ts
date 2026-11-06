"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { cleanMasterIds } from "@/lib/assign";
import { redirect } from "next/navigation";
import {
  addItem,
  createOrder,
  listItems,
  moveOrder,
  removeItem,
  setAllowOutOfSequence,
  setStatus,
  unarchiveOrder,
  updateOrder,
  type OrderInput,
} from "@/lib/orders";
import { cleanValues, itemLabel, missingRequired, type NewItem } from "@/lib/items";
import { templateForItem } from "@/lib/templates";
import { addReferencePhoto, completeStage, reviewPhoto } from "@/lib/stages";
import { storeUpload } from "@/lib/photo-upload";
import { refreshItemFromCategory } from "@/lib/item-sync";
import type { EditorState } from "@/lib/editor-state";
import { createMaster, reissueLink, setActive, setPin } from "@/lib/masters";
import { ORDER_STATUSES, type FieldDef, type OrderStatus } from "@/db/schema";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(f.get(k));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseOrder(f: FormData): OrderInput {
  const masterIds = cleanMasterIds(f.getAll("masterIds"));
  const input = {
    customerName: str(f, "customerName"),
    myDueDate: str(f, "myDueDate"),
    karigarDueDate: str(f, "karigarDueDate"),
    masterId: masterIds[0] ?? 0,
    masterIds,
    details: str(f, "details"),
  };
  if (!input.customerName || !DATE.test(input.myDueDate) || !DATE.test(input.karigarDueDate) || !input.masterId) {
    throw new Error("Please fill customer name, both due dates and choose at least one master.");
  }
  return input;
}

/** Stores the pictures chosen in the form for each picture field of one item, as reference pictures. A bad file is skipped. */
async function savePictures(f: FormData, orderId: number, itemId: number, key: string, fields: FieldDef[]) {
  for (const fd of fields) {
    if (fd.type !== "picture" && fd.type !== "longtext") continue;
    for (const file of f.getAll(`pic:${key}:${fd.key}`)) {
      if (!(file instanceof File) || file.size === 0) continue;
      const saved = await storeUpload(orderId, file);
      if (!("error" in saved)) addReferencePhoto({ orderId, itemId, fieldKey: fd.key, ...saved });
    }
  }
}

/**
 * Saves a new order (no orderId) or edits one (orderId). If required fields are empty it
 * returns a warning instead; sending again with force=1 ("Submit anyway") saves regardless.
 */
export async function saveOrderAction(prev: EditorState, f: FormData): Promise<EditorState> {
  await requireAdmin();
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") values[k] = k in values ? `${values[k]}
${v}` : v; // checkboxes send several
  const nonce = prev.nonce + 1;

  let input: OrderInput;
  try {
    input = parseOrder(f);
  } catch (e) {
    return { nonce, missing: [], values, error: (e as Error).message };
  }

  const force = f.get("force") === "1";
  const orderId = Number(f.get("orderId")) || 0;
  const collect = (key: string, fields: FieldDef[]) => {
    const raw: Record<string, string> = {};
    for (const fd of fields) {
      const name = `v:${key}:${fd.key}`;
      raw[fd.key] = fd.type === "checkboxes" ? f.getAll(name).map(String).join("\n") : String(f.get(name) ?? "");
    }
    return cleanValues(fields, raw);
  };

  const missing: string[] = [];
  if (orderId) {
    const itemValues = new Map<number, Record<string, string>>();
    for (const it of listItems(orderId)) {
      const vals = collect(String(it.id), it.snapshot.fields);
      itemValues.set(it.id, vals);
      for (const m of missingRequired(it.snapshot.fields, vals)) missing.push(`${it.label}: ${m.label}`);
    }
    if (missing.length && !force) return { nonce, missing, values };
    updateOrder(orderId, input, itemValues);
    for (const it of listItems(orderId)) await savePictures(f, orderId, it.id, String(it.id), it.snapshot.fields);
  } else {
    const items: NewItem[] = [];
    const keys: string[] = [];
    for (const key of f.getAll("itemKey").map(String)) {
      const tpl = templateForItem(Number(f.get(`t:${key}`)));
      if (!tpl) continue;
      const label = String(f.get(`l:${key}`) ?? tpl.snapshot.templateName);
      const vals = collect(key, tpl.snapshot.fields);
      for (const m of missingRequired(tpl.snapshot.fields, vals)) missing.push(`${label}: ${m.label}`);
      items.push({ templateId: tpl.id, label, snapshot: tpl.snapshot, values: vals });
      keys.push(key);
    }
    if (missing.length && !force) return { nonce, missing, values };
    const newId = createOrder(input, items);
    const saved = listItems(newId); // in the same order as the items given
    for (const [n, key] of keys.entries()) await savePictures(f, newId, saved[n].id, key, saved[n].snapshot.fields);
    redirect("/admin/customers");
  }
  redirect("/admin/customers");
}

export async function addItemAction(f: FormData) {
  await requireAdmin();
  const orderId = Number(f.get("orderId"));
  const tpl = templateForItem(Number(f.get("templateId")));
  if (tpl) {
    const same = listItems(orderId).filter((i) => i.templateId === tpl.id).length;
    addItem(orderId, {
      templateId: tpl.id,
      label: itemLabel(tpl.snapshot.templateName, same, same + 1),
      snapshot: tpl.snapshot,
      values: {},
    });
  }
  redirect(`/admin/orders/${orderId}`);
}

export async function removeItemAction(f: FormData) {
  await requireAdmin();
  const orderId = Number(f.get("orderId"));
  const res = removeItem(orderId, Number(f.get("itemId")));
  redirect(res.ok ? `/admin/orders/${orderId}?removed=1` : `/admin/orders/${orderId}?e=remove-${res.reason}`);
}

export async function moveOrderAction(f: FormData) {
  await requireAdmin();
  const dir = str(f, "dir") === "up" ? "up" : "down";
  moveOrder(num(f, "id"), dir);
  const back = str(f, "back");
  redirect(back.startsWith("/admin") ? back : "/admin/customers");
}

export async function setStatusAction(f: FormData) {
  await requireAdmin();
  const status = str(f, "status") as OrderStatus;
  if (ORDER_STATUSES.includes(status)) setStatus(num(f, "id"), status);
  redirect(status === "archived" ? "/admin/archive" : "/admin/customers");
}

/** Bring an archived order back to the Finished list. */
export async function unarchiveOrderAction(f: FormData) {
  await requireAdmin();
  unarchiveOrder(num(f, "id"));
  redirect("/admin/archive?view=archived");
}

export async function allowOutOfSequenceAction(f: FormData) {
  await requireAdmin();
  setAllowOutOfSequence(num(f, "id"), str(f, "allow") === "1");
  redirect(`/admin/orders/${num(f, "id")}`);
}

export async function createMasterAction(f: FormData) {
  await requireAdmin();
  const name = str(f, "name");
  const pin = str(f, "pin");
  if (!name || !pin) throw new Error("Name and PIN are required.");
  createMaster({ name, pin });
  redirect("/admin/masters");
}

export async function setPinAction(f: FormData) {
  await requireAdmin();
  const pin = str(f, "pin");
  if (pin) setPin(num(f, "id"), pin);
  redirect("/admin/masters");
}

export async function reissueLinkAction(f: FormData) {
  await requireAdmin();
  reissueLink(num(f, "id"));
  redirect("/admin/masters");
}

export async function setMasterActiveAction(f: FormData) {
  await requireAdmin();
  setActive(num(f, "id"), str(f, "active") === "1");
  redirect("/admin/masters");
}

export async function reviewPhotoAction(f: FormData) {
  await requireAdmin();
  const decision = str(f, "decision") === "approved" ? "approved" : "rejected";
  const res = reviewPhoto(num(f, "id"), decision, str(f, "comment"));
  redirect(res.ok ? "/admin/review" : `/admin/review?e=${res.reason}`);
}

export async function completeStageAdminAction(f: FormData) {
  await requireAdmin();
  const orderId = num(f, "orderId");
  // force = "Mark done anyway": skips the photo and fields check when a step cannot be finished the normal way
  const res = completeStage({ by: "admin", force: str(f, "force") === "1" }, num(f, "itemId"), str(f, "stageKey"));
  redirect(`/admin/orders/${orderId}${res.ok ? "" : `?e=${res.reason}`}`);
}

/** Copy the category's current form and steps into one item of an existing customer. */
export async function refreshItemAction(f: FormData) {
  await requireAdmin();
  const orderId = num(f, "orderId");
  const res = refreshItemFromCategory(num(f, "itemId"));
  redirect(`/admin/orders/${orderId}${res === "ok" ? "?updated=1" : `?e=refresh-${res}`}`);
}

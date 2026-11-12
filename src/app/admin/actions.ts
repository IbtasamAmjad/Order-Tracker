"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { cleanMasterIds } from "@/lib/assign";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addNotePictures, removeNotePicture } from "@/lib/order-notes";
import { addOrderPdf, chosenPdfs, listOrderFiles, pdfProblem, removeOrderFile } from "@/lib/order-files";
import { checkDesignNumbers,
  addItem,
  createOrder,
  getOrder,
  listItems,
  moveOrder,
  removeItem,
  sendOrder,
  setAllowOutOfSequence,
  setStatus,
  unarchiveOrder,
  updateOrder,
  type OrderInput,
} from "@/lib/orders";
import { remakeItems } from "@/lib/remake";
import { setSetting } from "@/lib/settings";
import { cleanValues, itemLabel, missingFields, type NewItem } from "@/lib/items";
import { templateForItem } from "@/lib/templates";
import { addReferencePhoto, completeStage, reviewPhoto } from "@/lib/stages";
import { storeUpload } from "@/lib/photo-upload";
import { addStageNote, setInstruction } from "@/lib/history";
import { refreshItemFromCategory } from "@/lib/item-sync";
import type { EditorState } from "@/lib/editor-state";
import { createMaster, deleteMaster, reissueLink, setActive, setPin } from "@/lib/masters";
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
    designNumber: str(f, "designNumber"),
  };
  if (!input.customerName || !input.designNumber || !DATE.test(input.myDueDate) || !DATE.test(input.karigarDueDate) || !input.masterId) {
    throw new Error("Please fill customer name, design number, both due dates and choose at least one master.");
  }
  return input;
}

/** Stores the pictures chosen in the form for each picture field of one item, as reference pictures. A bad file is skipped. */
async function savePictures(f: FormData, orderId: number, itemId: number, key: string, fields: FieldDef[]) {
  for (const fd of fields) {
    if (!["picture", "text", "longtext", "number"].includes(fd.type)) continue; // a picture pasted into any text or number box is kept under it
    for (const file of f.getAll(`pic:${key}:${fd.key}`)) {
      if (!(file instanceof File) || file.size === 0) continue;
      const saved = await storeUpload(orderId, file);
      if (!("error" in saved)) addReferencePhoto({ orderId, itemId, fieldKey: fd.key, ...saved });
    }
  }
}

/**
 * Saves a new order (no orderId) or edits one (orderId). If any field is empty it saves nothing and
 * returns the list of what is missing.
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
    return { nonce, missing: [], missingKeys: [], values, error: (e as Error).message };
  }

  const orderId = Number(f.get("orderId")) || 0;
  // "Send to master" makes the order visible to him; "Save" on a draft keeps it private, so incomplete work can be saved.
  const send = str(f, "intent") === "send";
  const wasSent = orderId ? !!getOrder(orderId)?.sentAt : false;
  const draftSave = !send && !wasSent; // saving an unsent order: the fields may stay empty
  // a design number is used once; a link must point at another order's design number
  const designProblem = checkDesignNumbers(input, orderId || undefined);
  if (designProblem) return { nonce, missing: [], missingKeys: [], values, error: designProblem };
  const collect = (key: string, fields: FieldDef[]) => {
    const raw: Record<string, string> = {};
    for (const fd of fields) {
      const name = `v:${key}:${fd.key}`;
      raw[fd.key] = fd.type === "checkboxes" ? f.getAll(name).map(String).join("\n") : String(f.get(name) ?? "");
    }
    return cleanValues(fields, raw);
  };

  // PDF files chosen in the form: they must be real PDFs. With a PDF attached (new or already saved), the item fields may stay empty.
  const pdfs = chosenPdfs(f);
  for (const file of pdfs) {
    const bad = await pdfProblem(file);
    if (bad) return { nonce, missing: [], missingKeys: [], values, error: bad };
  }
  const hasPdf = pdfs.length > 0 || (orderId ? listOrderFiles(orderId).length > 0 : false);
  const savePdfs = async (id: number) => {
    for (const file of pdfs) await addOrderPdf(id, file);
  };

  const missing: string[] = [];
  const missingKeys: string[] = [];
  if (orderId) {
    const itemValues = new Map<number, Record<string, string>>();
    for (const it of listItems(orderId)) {
      const vals = collect(String(it.id), it.snapshot.fields);
      itemValues.set(it.id, vals);
      for (const m of hasPdf || draftSave ? [] : missingFields(it.snapshot.fields, vals)) {
        missing.push(`${it.label}: ${m.label}`);
        missingKeys.push(`${it.id}:${m.key}`);
      }
    }
    if (missing.length) return { nonce, missing, missingKeys, values };
    updateOrder(orderId, input, itemValues);
    await savePdfs(orderId);
    await addNotePictures(orderId, f.getAll("pic:notes").filter((x): x is File => x instanceof File));
    for (const it of listItems(orderId)) await savePictures(f, orderId, it.id, String(it.id), it.snapshot.fields);
    if (!wasSent) {
      if (send && sendOrder(orderId)) redirect(`/admin/customers?notify=new:${orderId}`);
      redirect(`/admin/orders/${orderId}?draft=1`);
    }
  } else {
    const items: NewItem[] = [];
    const keys: string[] = [];
    for (const key of f.getAll("itemKey").map(String)) {
      const tpl = templateForItem(Number(f.get(`t:${key}`)));
      if (!tpl) continue;
      const label = String(f.get(`l:${key}`) ?? tpl.snapshot.templateName);
      const vals = collect(key, tpl.snapshot.fields);
      for (const m of hasPdf || draftSave ? [] : missingFields(tpl.snapshot.fields, vals)) {
        missing.push(`${label}: ${m.label}`);
        missingKeys.push(`${key}:${m.key}`);
      }
      items.push({ templateId: tpl.id, label, snapshot: tpl.snapshot, values: vals });
      keys.push(key);
    }
    if (missing.length) return { nonce, missing, missingKeys, values };
    const newId = createOrder(input, items, { draft: !send });
    await savePdfs(newId);
    await addNotePictures(newId, f.getAll("pic:notes").filter((x): x is File => x instanceof File));
    const saved = listItems(newId); // in the same order as the items given
    for (const [n, key] of keys.entries()) await savePictures(f, newId, saved[n].id, key, saved[n].snapshot.fields);
    redirect(send ? `/admin/customers?notify=new:${newId}` : `/admin/orders/${newId}?draft=1`);
  }
  redirect(orderId ? `/admin/customers?notify=updated:${orderId}` : "/admin/customers");
}

/** Takes one picture off the notes of a customer (the cross next to it). */
export async function removeNotePictureAction(orderId: number, photoId: number) {
  await requireAdmin();
  await removeNotePicture(Number(orderId), Number(photoId));
  revalidatePath(`/admin/orders/${orderId}`);
}

/** Takes a PDF off an order (the Remove button next to it). */
export async function removeOrderFileAction(orderId: number, fileId: number) {
  await requireAdmin();
  await removeOrderFile(Number(orderId), Number(fileId));
  revalidatePath(`/admin/orders/${orderId}`);
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

/** The office sends some items of an order (or all) back for a remake, with the reason. */
export async function remakeItemsAction(f: FormData) {
  await requireAdmin();
  const orderId = num(f, "orderId");
  const ids = f.getAll("item").map(Number).filter(Boolean);
  const res = remakeItems(orderId, ids, str(f, "reason"));
  redirect(res.ok ? `/admin/customers?notify=updated:${orderId}` : `/admin/orders/${orderId}?e=remake-${res.reason}`);
}

export async function moveOrderAction(f: FormData) {
  await requireAdmin();
  const dir = str(f, "dir") === "up" ? "up" : "down";
  moveOrder(num(f, "id"), dir, Number(f.get("with")) || undefined);
  const back = str(f, "back");
  redirect(back.startsWith("/admin") ? back : "/admin/customers");
}

export async function setStatusAction(f: FormData) {
  await requireAdmin();
  const status = str(f, "status") as OrderStatus;
  if (ORDER_STATUSES.includes(status)) setStatus(num(f, "id"), status);
  redirect(status === "archived" ? "/admin/archive" : status === "cancelled" ? `/admin/customers?notify=cancelled:${num(f, "id")}` : "/admin/customers");
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

/** The office WhatsApp number masters send their questions to (digits only; empty clears it). */
export async function saveOfficeWhatsappAction(f: FormData) {
  await requireAdmin();
  setSetting("office_whatsapp", str(f, "number").replace(/\D/g, ""));
  revalidatePath("/admin/masters");
  redirect("/admin/masters?office=saved");
}

export async function createMasterAction(f: FormData) {
  await requireAdmin();
  const name = str(f, "name");
  const pin = str(f, "pin");
  if (!name || !pin) throw new Error("Name and PIN are required.");
  createMaster({ name, pin, whatsappNumber: str(f, "whatsapp").replace(/\D/g, "") });
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

export async function deleteMasterAction(f: FormData) {
  await requireAdmin();
  const res = deleteMaster(num(f, "id"));
  redirect(res === "deleted" ? "/admin/masters" : "/admin/masters?e=has-work");
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
  redirect(res.ok ? `/admin/review?told=${num(f, "id")}` : `/admin/review?e=${res.reason}`);
}

export async function completeStageAdminAction(f: FormData) {
  await requireAdmin();
  const orderId = num(f, "orderId");
  // force = "Mark done anyway": skips the photo and fields check when a step cannot be finished the normal way
  const res = completeStage({ by: "admin", force: str(f, "force") === "1" }, num(f, "itemId"), str(f, "stageKey"));
  redirect(`/admin/orders/${orderId}${res.ok ? "" : `?e=${res.reason}`}`);
}

/** The step buttons inside the customer form: step = "itemId:stageKey" or "itemId:stageKey:force". */
export async function stepAdminAction(f: FormData) {
  await requireAdmin();
  const orderId = num(f, "orderId");
  const [itemId, stageKey, mode] = str(f, "step").split(":");
  const res = completeStage({ by: "admin", force: mode === "force" }, Number(itemId), stageKey ?? "");
  redirect(`/admin/orders/${orderId}${res.ok ? "" : `?e=${res.reason}`}`);
}

/** A note on one step, from inside an item's card: target = "itemId:stageKey". */
export async function stepNoteAction(f: FormData) {
  await requireAdmin();
  const orderId = num(f, "orderId");
  const target = str(f, "target");
  const [itemId, ...rest] = target.split(":");
  addStageNote({ by: "admin" }, Number(itemId), rest.join(":"), String(f.get(`note:${target}`) ?? ""));
  redirect(`/admin/orders/${orderId}`);
}

/** The office's instruction for one step: target = "itemId:stageKey". An empty text removes it. */
export async function instructionAction(f: FormData) {
  await requireAdmin();
  const orderId = num(f, "orderId");
  const target = str(f, "target");
  const [itemId, ...rest] = target.split(":");
  setInstruction(Number(itemId), rest.join(":"), String(f.get(`instr:${target}`) ?? ""));
  redirect(`/admin/orders/${orderId}`);
}

/** Copy the category's current form and steps into one item of an existing customer. */
export async function refreshItemAction(f: FormData) {
  await requireAdmin();
  const orderId = num(f, "orderId");
  const res = refreshItemFromCategory(num(f, "itemId"));
  redirect(`/admin/orders/${orderId}${res === "ok" ? "?updated=1" : `?e=refresh-${res}`}`);
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMasterByToken } from "@/lib/masters";
import { clearFailures, isLocked, recordFailure, verifyPin } from "@/lib/pin";
import { masterComplete, masterSaveFields } from "@/lib/orders";
import { requireMaster } from "@/lib/master-session";
import { completeStage } from "@/lib/stages";
import { saveShipmentItems, submitShipment } from "@/lib/shipping";

export async function submitPinAction(f: FormData) {
  const token = String(f.get("token") ?? "");
  const pin = String(f.get("pin") ?? "");
  const master = getMasterByToken(token);
  if (!master || !master.active) redirect(`/m/${token}`);

  if (isLocked(token)) redirect(`/m/${token}?e=locked`);
  if (!verifyPin(pin, master.pinHash)) {
    recordFailure(token);
    redirect(`/m/${token}?e=wrong`);
  }
  clearFailures(token);
  (await cookies()).set(`ms_${token}`, master.sessionSecret, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(`/m/${token}`);
}

export async function completeOrderAction(f: FormData) {
  const token = String(f.get("token") ?? "");
  const orderId = Number(f.get("orderId"));
  const master = await requireMaster(token);
  if (!master) redirect(`/m/${token}`);
  const res = masterComplete(master.id, orderId);
  redirect(res.ok ? `/m/${token}` : `/m/${token}/orders/${orderId}?e=${res.reason}`);
}

export async function completeStageAction(f: FormData) {
  const token = String(f.get("token") ?? "");
  const orderId = Number(f.get("orderId"));
  const master = await requireMaster(token);
  if (!master) redirect(`/m/${token}`);
  const res = completeStage({ by: "master", masterId: master.id }, Number(f.get("itemId")), String(f.get("stageKey") ?? ""));
  redirect(`/m/${token}/orders/${orderId}${res.ok ? "" : `?e=${res.reason}`}`);
}

// ---------------------------------------------------------------- shipping

/**
 * One button does it all: save the ticked items (ticking an item means "I checked it is here"),
 * then send the shipment. Anything missing (no bill, an item not approved yet, not his turn)
 * brings the master back to the shipping page with a plain message, and the ticks are kept.
 */
export async function sendShipmentAction(f: FormData) {
  const token = String(f.get("token") ?? "");
  const orderId = Number(f.get("orderId"));
  const sid = Number(f.get("shipmentId"));
  const master = await requireMaster(token);
  if (!master) redirect(`/m/${token}`);
  const ids = (name: string) => f.getAll(name).map(Number).filter(Boolean);
  saveShipmentItems(master.id, sid, ids("inc"), ids("chk"));
  const res = submitShipment(master.id, sid);
  redirect(
    res.ok
      ? `/m/${token}/orders/${orderId}/ship?sent=${sid}`
      : `/m/${token}/orders/${orderId}/ship?e=${res.reason}`,
  );
}

// ---------------------------------------------------------------- master fills his fields

export async function saveMasterFieldsAction(f: FormData) {
  const token = String(f.get("token") ?? "");
  const orderId = Number(f.get("orderId"));
  const itemId = Number(f.get("itemId"));
  const master = await requireMaster(token);
  if (!master) redirect(`/m/${token}`);
  const raw: Record<string, string> = {};
  for (const [k, v] of f.entries()) {
    if (typeof v === "string" && k.startsWith("v:")) raw[k.slice(2)] = k.slice(2) in raw ? `${raw[k.slice(2)]}\n${v}` : v;
  }
  const ok = masterSaveFields(master.id, orderId, itemId, raw);
  redirect(`/m/${token}/orders/${orderId}${ok ? "?saved=1" : "?e=not-saved"}`);
}

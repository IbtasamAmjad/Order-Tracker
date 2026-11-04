"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, SESSION_DAYS, checkPassword, createSession, safeNext } from "@/lib/admin-session";
import { clearFailures, isLocked, recordFailure } from "@/lib/pin";

export async function loginAction(f: FormData) {
  const next = safeNext(String(f.get("next") ?? ""));
  const secret = process.env.SESSION_SECRET;
  if (!process.env.ADMIN_PASSWORD || !secret || secret.length < 16) redirect("/admin/login?e=unset");

  // wrong-password limit, per visitor address (resets on restart)
  const h = await headers();
  const key = `admin:${h.get("x-forwarded-for")?.split(",")[0].trim() ?? "local"}`;
  if (isLocked(key)) redirect(`/admin/login?e=locked&next=${encodeURIComponent(next)}`);

  if (!checkPassword(String(f.get("password") ?? ""), process.env.ADMIN_PASSWORD)) {
    recordFailure(key);
    redirect(`/admin/login?e=wrong&next=${encodeURIComponent(next)}`);
  }
  clearFailures(key);
  (await cookies()).set(ADMIN_COOKIE, await createSession(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(next);
}

export async function logoutAction() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

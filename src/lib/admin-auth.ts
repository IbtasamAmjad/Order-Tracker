import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifySession } from "./admin-session";

export async function isAdmin(): Promise<boolean> {
  return verifySession((await cookies()).get(ADMIN_COOKIE)?.value, process.env.SESSION_SECRET);
}

/**
 * Second line of defence behind proxy.ts: call at the start of every admin server action.
 * (A server action is a POST to a page URL, so we do not rely on the proxy alone.)
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

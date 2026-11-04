import { cookies } from "next/headers";
import { getMasterByToken } from "./masters";

/** Returns the master only if the link is valid, active, and the PIN cookie matches. */
export async function requireMaster(token: string) {
  const master = getMasterByToken(token);
  if (!master || !master.active) return null;
  const cookie = (await cookies()).get(`ms_${token}`)?.value;
  return cookie && cookie === master.sessionSecret ? master : null;
}

export type LinkState = "ok" | "invalid" | "need-pin";

export async function linkState(token: string): Promise<LinkState> {
  const master = getMasterByToken(token);
  if (!master || !master.active) return "invalid";
  return (await requireMaster(token)) ? "ok" : "need-pin";
}

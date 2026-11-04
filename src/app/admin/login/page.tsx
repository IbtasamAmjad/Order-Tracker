import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { safeNext } from "@/lib/admin-session";
import { Notice, btnPrimary, input } from "@/components/ui";
import { loginAction } from "./actions";

const ERRORS: Record<string, string> = {
  wrong: "Wrong password. Try again.",
  locked: "Too many tries. Wait 5 minutes.",
  unset: "The admin password is not set on the server. Set ADMIN_PASSWORD and SESSION_SECRET (see .env.example).",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string; next?: string }> }) {
  const { e, next } = await searchParams;
  if (await isAdmin()) redirect(safeNext(next));

  return (
    <main className="flex min-h-[85vh] items-center justify-center p-2">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="mx-auto text-3xl">Order Tracker</h1>
          <hr className="stitch mx-auto my-3 w-24" />
          <p className="page-sub">The order book for your workshop.</p>
        </div>

        <form action={loginAction} className="panel space-y-4 p-6">
          <input type="hidden" name="next" value={safeNext(next)} />
          <label className="block">
            <span className="mb-1.5 block text-base font-medium">Admin password</span>
            <input
              type="password"
              name="password"
              required
              autoFocus
              autoComplete="current-password"
              className={input}
              placeholder="Enter your password"
            />
          </label>
          {e && ERRORS[e] && <Notice tone="error">{ERRORS[e]}</Notice>}
          <button className={`${btnPrimary} w-full`}>Sign in</button>
        </form>
      </div>
    </main>
  );
}

import { submitPinAction } from "@/app/m/actions";
import { btnPrimary, input } from "./ui";

export function PinForm({ token, error }: { token: string; error?: string }) {
  return (
    <form action={submitPinAction} className="space-y-4">
      <h1 className="page-title">Enter your code</h1>
      <input type="hidden" name="token" value={token} />
      <input
        name="pin"
        required
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        className={`${input} text-center text-3xl tracking-widest`}
        aria-label="Your code"
      />
      {error === "wrong" && <p className="text-lg font-medium text-thread">Wrong code. Try again.</p>}
      {error === "locked" && (
        <p className="text-lg font-medium text-thread">Too many tries. Wait 5 minutes.</p>
      )}
      <button className={`${btnPrimary} w-full`}>Open</button>
    </form>
  );
}

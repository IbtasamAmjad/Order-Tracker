import { listMasters } from "@/lib/masters";
import { APP_URL } from "@/lib/config";
import { Field, btnPrimary, btnSecondary, input } from "@/components/ui";
import { createMasterAction, reissueLinkAction, setMasterActiveAction, setPinAction } from "../actions";

export default function Masters() {
  const masters = listMasters();
  return (
    <div className="space-y-6">
      <h1 className="page-title">Masters</h1>

      <ul className="space-y-4">
        {masters.map((m) => {
          const link = `${APP_URL}/m/${m.token}`;
          return (
            <li key={m.id} className="space-y-3 panel">
              <div className="text-xl font-medium">
                {m.name} {!m.active && <span className="text-thread">(inactive)</span>}
              </div>
              <input readOnly value={link} className={input} aria-label="Personal link" />

              <form action={setPinAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={m.id} />
                <input name="pin" required placeholder="New PIN (e.g. 1234A)" className={`${input} min-w-0 flex-1 basis-40`} />
                <button className={btnSecondary}>Set PIN</button>
              </form>

              <div className="flex flex-wrap gap-2">
                <form action={reissueLinkAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className={btnSecondary}>New link (old one stops)</button>
                </form>
                <form action={setMasterActiveAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="active" value={m.active ? "0" : "1"} />
                  <button className={btnSecondary}>{m.active ? "Deactivate" : "Activate"}</button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      <form action={createMasterAction} className="space-y-4 panel">
        <h2 className="text-xl font-medium">Add a master</h2>
        <Field label="Name">
          <input name="name" required className={input} />
        </Field>
        <Field label="PIN (numbers and letters)">
          <input name="pin" required className={input} />
        </Field>
        <button className={`${btnPrimary} w-full`}>Add master</button>
      </form>
    </div>
  );
}

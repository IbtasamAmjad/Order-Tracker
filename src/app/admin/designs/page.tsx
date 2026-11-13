import Link from "next/link";
import { createDesignAction } from "../design-actions";
import { listDesigns } from "@/lib/designs";
import { PictureInput } from "@/components/PictureInput";
import { Field, PageHeader, btnPrimary, input, textarea } from "@/components/ui";

export default async function DesignCategory({ searchParams }: { searchParams: Promise<{ e?: string; added?: string }> }) {
  const { e, added } = await searchParams;
  const designs = listDesigns();

  return (
    <div className="space-y-6">
      <PageHeader title="Design Category" icon="designs" sub="Your design numbers and their pictures." />

      {e && (
        <p role="alert" className="alert alert-error text-base font-medium">
          {e}
        </p>
      )}
      {added && <p className="alert alert-success text-base font-medium">Design added.</p>}

      <form action={createDesignAction} className="panel space-y-4">
        <h2 className="text-xl font-medium">Add a design</h2>
        <Field label="Design number" required>
          <input name="name" required placeholder="e.g. NS-1042" className={`${input} uppercase`} autoCapitalize="characters" spellCheck={false} />
        </Field>
        <Field label="Notes (optional)">
          <textarea name="notes" rows={2} className={textarea} />
        </Field>
        <Field label="Pictures of the design">
          <PictureInput name="pics" />
        </Field>
        <button className={btnPrimary}>Add design</button>
      </form>

      {designs.length === 0 ? (
        <p className="text-lg">No designs yet. Add the first one above.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {designs.map((d) => (
            <li key={d.id} className={`panel relative !p-3 ${d.active ? "" : "opacity-60"}`}>
              <div className="aspect-square overflow-hidden rounded-xl bg-paper-3">
                {d.photoIds[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/admin/designs/${d.photoIds[0]}?thumb=1`} alt={d.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted">No picture</div>
                )}
              </div>
              <Link href={`/admin/designs/${d.id}`} className="mt-2 block text-lg font-medium after:absolute after:inset-0">
                {d.name}
              </Link>
              <p className="text-sm text-muted">
                {d.photoIds.length} {d.photoIds.length === 1 ? "picture" : "pictures"}
                {d.active ? "" : " - hidden"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

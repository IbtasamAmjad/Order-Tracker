import Link from "next/link";
import { notFound } from "next/navigation";
import { getDesign } from "@/lib/designs";
import { Icon } from "@/components/Icon";
import { PictureInput } from "@/components/PictureInput";
import { Field, PageHeader, btnPrimary, btnSecondary, input, textarea } from "@/components/ui";
import { removeDesignPictureAction, saveDesignAction, setDesignActiveAction } from "../../design-actions";

export default async function EditDesign({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; saved?: string }> }) {
  const d = getDesign(Number((await params).id));
  if (!d) notFound();
  const { e, saved } = await searchParams;

  return (
    <div className="space-y-5">
      <PageHeader title={d.name} icon="designs" sub="Change this design number or its pictures." />
      <Link href="/admin/designs" className="link text-base font-medium">
        Back to Design Category
      </Link>
      {e && (
        <p role="alert" className="alert alert-error text-base font-medium">
          {e}
        </p>
      )}
      {saved && <p className="alert alert-success text-base font-medium">Saved.</p>}

      {d.photoIds.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {d.photoIds.map((pid) => (
            <li key={pid} className="relative w-32">
              <a href={`/api/admin/designs/${pid}`} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl border border-rule bg-paper-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/designs/${pid}?thumb=1`} alt={d.name} className="h-full w-full object-cover" />
              </a>
              <form action={removeDesignPictureAction}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="photoId" value={pid} />
                <button aria-label="Remove this picture" className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-ink text-white">
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={saveDesignAction} className="panel space-y-4">
        <input type="hidden" name="id" value={d.id} />
        <Field label="Design number" required>
          <input name="name" required defaultValue={d.name} className={`${input} uppercase`} autoCapitalize="characters" spellCheck={false} />
        </Field>
        <Field label="Notes (optional)">
          <textarea name="notes" rows={2} defaultValue={d.notes} className={textarea} />
        </Field>
        <Field label="Add more pictures">
          <PictureInput name="pics" />
        </Field>
        <button className={btnPrimary}>Save</button>
      </form>

      <form action={setDesignActiveAction}>
        <input type="hidden" name="id" value={d.id} />
        <input type="hidden" name="active" value={d.active ? "0" : "1"} />
        <button className={btnSecondary}>{d.active ? "Hide from the customer form" : "Show on the customer form again"}</button>
      </form>
    </div>
  );
}

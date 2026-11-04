import { AdminSidebar } from "@/components/AdminSidebar";
import { Icon } from "@/components/Icon";
import { isAdmin } from "@/lib/admin-auth";
import { remindersList } from "@/lib/reminders";
import { unseenShipmentCount } from "@/lib/shipping";
import { pendingPhotoCount } from "@/lib/stages";
import { listCategoryTree } from "@/lib/templates";
import { logoutAction } from "./login/actions";

export const dynamic = "force-dynamic";

/** Wordmark: the board's face in a square plate. */
function Brand() {
  return (
    <span className="font-display text-xl font-medium leading-none tracking-tight text-ink lowercase">
      Order Tracker
    </span>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // the sign-in page uses this layout too: no menu (and no data) until signed in
  if (!(await isAdmin())) return <div className="mx-auto w-full max-w-3xl p-4">{children}</div>;

  const groups = listCategoryTree()
    .map((g) => ({
      id: g.id,
      name: g.name,
      categories: g.subs.map((s) => ({ templateId: s.template.id, name: s.name, colour: s.colour })),
    }))
    .filter((g) => g.categories.length > 0);
  const counts = { photos: pendingPhotoCount(), reminders: remindersList().length, shipments: unseenShipmentCount() };

  return (
    <div className="drawer min-h-screen lg:drawer-open print:block">
      <input id="admin-nav" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 bg-paper-2 px-3 text-ink print:hidden lg:hidden">
          <label htmlFor="admin-nav" className="btn btn-ghost btn-square min-h-11 min-w-11 text-ink" aria-label="Open the menu">
            <Icon name="menu" className="h-6 w-6" />
          </label>
          <Brand />
        </header>

        <main className="min-w-0 flex-1 p-4 print:p-0 sm:p-6 lg:px-12 lg:py-10">
          <div className="mx-auto w-full max-w-5xl print:max-w-none">{children}</div>
        </main>
      </div>

      <div className="drawer-side z-40 print:hidden">
        <label htmlFor="admin-nav" aria-label="Close the menu" className="drawer-overlay" />
        <div className="flex min-h-full flex-col bg-paper-2">
          <div className="flex min-h-20 items-center px-6 pt-2">
            <Brand />
          </div>
          <AdminSidebar groups={groups} counts={counts} logout={logoutAction} />
        </div>
      </div>
    </div>
  );
}

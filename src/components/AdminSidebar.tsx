"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";

export type SidebarGroup = {
  id: number;
  name: string;
  categories: { templateId: number; name: string; colour: string }[];
};

type Counts = { photos: number; reminders: number; shipments: number };

function closeDrawer() {
  // on a phone the menu is a slide-out drawer: close it after choosing a tab
  const box = document.getElementById("admin-nav") as HTMLInputElement | null;
  if (box) box.checked = false;
}

const row = "group flex min-h-11 w-full items-center gap-3 rounded-full border border-transparent px-4 py-2 text-left text-base font-medium";

export function AdminSidebar({
  groups,
  counts,
  logout,
}: {
  groups: SidebarGroup[];
  counts: Counts;
  logout: () => Promise<void>;
}) {
  const path = usePathname();
  const onCategories = path.startsWith("/admin/templates");
  const [open, setOpen] = useState(onCategories);

  const is = (...prefixes: string[]) => prefixes.some((p) => (p === "/admin" ? path === "/admin" : path.startsWith(p)));
  const tab = (active: boolean) =>
    `${row} ${active ? "border-transparent bg-paper-3 text-ink" : "text-ink-2 hover:bg-paper-3 hover:text-ink"}`;

  const item = (href: string, icon: string, label: string, active: boolean, badge = 0) => (
    <Link href={href} onClick={closeDrawer} className={tab(active)} aria-current={active ? "page" : undefined}>
      <Icon name={icon} className="h-5 w-5 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span
          className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-sm font-medium ${
            active ? "bg-accent text-accent-ink" : "bg-bad text-accent-ink"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );

  const divider = () => <hr className="stitch my-3" />;

  return (
    <aside className="flex min-h-full w-72 flex-col px-3 pb-4 print:hidden">
      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Admin menu">
                {item("/admin", "home", "Home", is("/admin"))}
        {item("/admin/customers", "customers", "Customers", is("/admin/customers", "/admin/orders"))}

        {divider()}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={tab(onCategories && !open)}
        >
          <Icon name="categories" className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-left">Categories</span>
          <Icon name="chevron" className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="ml-4 space-y-0.5 border-l border-rule pb-2 pl-3">
            <Link
              href="/admin/templates"
              onClick={closeDrawer}
              className="flex min-h-10 items-center gap-2 px-3 text-sm font-medium text-accent hover:underline"
            >
              <Icon name="categories" className="h-4 w-4" /> All categories
            </Link>
            {groups.map((g) => (
              <div key={g.id}>
                <p className="px-3 pt-2 text-sm text-muted">{g.name}</p>
                {g.categories.map((c) => {
                  const active = path === `/admin/templates/${c.templateId}`;
                  return (
                    <Link
                      key={c.templateId}
                      href={`/admin/templates/${c.templateId}`}
                      onClick={closeDrawer}
                      className={`flex min-h-10 items-center gap-2.5 rounded-full border border-transparent px-4 text-base font-medium ${active ? "border-transparent bg-paper-3 text-ink" : "text-ink-2 hover:bg-paper-3 hover:text-ink"}`}
                    >
                      <span className="inline-block h-3 w-3 shrink-0" style={{ background: c.colour }} />
                      {c.name}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {item("/admin/masters", "masters", "Masters", is("/admin/masters"))}

        {divider()}
        {item("/admin/review", "photos", "Photos to check", is("/admin/review"), counts.photos)}
        {item("/admin/reminders", "reminders", "Reminders", is("/admin/reminders"), counts.reminders)}
        {item("/admin/shipments", "shipments", "Shipments", is("/admin/shipments"), counts.shipments)}
        {item("/admin/archive", "finished", "Finished", is("/admin/archive"))}
      </nav>

      <form action={logout} className="mt-4 border-t border-rule pt-3">
        <button className={`${row} text-ink-2 hover:bg-paper-3 hover:text-ink`}>
          <Icon name="logout" className="h-5 w-5 shrink-0" />
          Log out
        </button>
      </form>
    </aside>
  );
}

# Order Tracker

Lightweight web app (PWA) for a custom-clothing business (men's Sherwani, Kurta, Pagri, shoes, etc.; ladies' wear too). The **Admin** (Anas) adds customers, picks categories for each (Kurta, Sherwani...), fills each category's admin-built form, assigns a master, and sets priority. Factory **Masters** open a personal link + PIN, see only their assigned customers in Anas's sequence, fill the fields Anas allows (comments, pictures), upload photos, tick off steps, send shipments, and download/print a PDF (one page per category).

## Stack (as built)
Next.js 16 (App Router, TypeScript), Tailwind 4 + daisyUI 5 (CSS only), SQLite via Drizzle ORM (`better-sqlite3`), JSON columns for forms and filled values. Client-side image compression (`browser-image-compression`), server re-encode + thumbnails (`sharp`), PDF via `@react-pdf/renderer`, drag and drop via `@dnd-kit`. Admin login is a small built-in one (not Auth.js; chosen with the user). See `docs/06-tech-stack.md` for the original plan.

## Non-negotiable rules
- Mobile-first, English only, very simple UI. Masters have cheap Android phones, weak internet, and basic literacy. Big buttons, few options, no clutter.
- Only two roles: **Admin** and **Master**. No usernames/passwords for Masters (personal URL + PIN).
- Only four built-in order fields: **order number** (auto), **customer name** (not unique), **My due date** (admin-only) and **Karigar due date**. Everything else comes from admin-defined category forms.
- Masters can never reorder, delete, or see other Masters' data. **My due date must never reach a master screen, a master API, a printout/PDF or a WhatsApp message.**
- Priority is one numeric sequence controlled only by Admin.
- No hard deletes of orders: they are cancelled, then archived. (Categories can be deleted by Admin; old orders keep their own copy of the form.)
- "Doesn't have to be pretty, just functional." Do not over-engineer or over-secure.

## Source of truth
- `docs/` (files 01-09) is the source of truth. `docs/reference/` is raw material (messy transcript), not a spec.
- Anything in `docs/08-open-questions.md` is undecided: **ask the user before deciding it**. Answers so far are recorded at the bottom of that file ("Decisions"), including unconfirmed working assumptions (#5 WhatsApp is manual click-to-send, #19 the bill is one photo per shipment). Never silently invent an answer.

## How to work
1. Work one thing at a time; confirm the plan in a few lines before big changes.
2. Keep storage and notifications behind small helpers (`src/lib/storage.ts`, `src/lib/whatsapp.ts`) so providers can be swapped.
3. Verify with `npx tsc --noEmit`, `npm run lint`, `npm test`, and for UI changes look at it in the browser. Say plainly what was NOT tested.
4. Never guess about Next.js 16: read `node_modules/next/dist/docs/` first (e.g. `middleware` is now `proxy.ts`; `params`/`searchParams` are Promises).

## Commands
```
npm install
npm run dev          # http://localhost:3000 (admin at /admin)
npm run build
npm test             # vitest (in-memory SQLite; never touches data/app.db)
npm run lint
npm run db:generate  # create a migration from src/db/schema.ts
npm run db:migrate   # apply migrations to ./data/app.db (override with DATABASE_URL)
```
Environment (`.env.local` for dev, real server env in production; see `.env.example`): `ADMIN_PASSWORD`, `SESSION_SECRET` (32+ random chars), `APP_URL` (public address; WhatsApp messages contain masters' links built from it), optional `DATABASE_URL`, `UPLOAD_DIR`. `.env.local` is git-ignored and holds a generated dev password.

## Terminology (UI words vs code words)
- UI says **Customers**; code says **orders** (`orders` table, `/admin/customers` lists them). Order number is the identifier, customer name is not unique.
- UI says **Categories** (Group > Category, e.g. Men > Kurta); code says **categories/templates** (`categories` two levels; one `templates` row per sub-category holding `fields`, `stages`, `printGroup`).
- A customer's chosen category becomes an **order item** with a **snapshot** of the form, so editing or deleting a category never changes existing customers.

## What is built
- **Orders/priority (Phase 1):** one global priority sequence; Admin move up/down moves among that master's orders; colour bands (red urgent / green coming due / blue later, thresholds in `src/lib/config.ts`); New / Updated / Moved up badges; "seen" tracking; cancel -> archive; completed/cancelled stay visible to the master 15 days.
- **Out-of-turn rule (decision #18):** a master may upload photos on any order but cannot complete steps, submit shipments or mark complete unless it is his first active order or Admin ticked "Allow before earlier orders".
- **Category forms (Phase 2):** drag-and-drop builder with 13 field types: text, long text (comments), number (+unit), phone, date, time, dropdown, choose one, choose many, yes/no, picture (image uploader), bold heading, note. Per field: required (a warning only; Admin can "Submit anyway") and **"master can fill this in"**. Steps (stages) live in the same builder.
- **Photo gate (Phase 3):** per-step photo none/optional/required; photo-required steps need Admin approval before the master can complete them and the next step unlocks; rejection needs a comment; review queue; photos compressed on phone, re-encoded to WebP <= ~400 KB, stored on disk with random names and only served through checked routes.
- **Shipping gate:** an item can only be put in a shipment when all its steps are finished and none of its step photos is waiting for approval (a rejected photo on an unfinished step blocks until a new one is approved). Items whose category has no steps have nothing to approve and ship freely. Enforced in `src/lib/shipping.ts` (`itemShipReadiness`, used by `saveShipmentItems` and `submitShipment`); the master sees what is blocking each item, Anas sees "Shipping: waiting ..." on the order.
- **Stuck-order tools:** the master can only press Mark complete on an order with no items; an order with items closes when its last item ships (`masterComplete` refuses with not-shipped). Admin can finish a stuck step with "Mark done anyway" (`completeStage` with `force`) and can copy a changed category into an existing item with "Update from the category" (`src/lib/item-sync.ts`: values and finished steps stay). The review queue and its badge only count active orders. The dashboard lists steps waiting on a field only the office can fill (`officeTodo`). Shipping turn rule is `canMasterShip`: an earlier order with nothing ready to send does not hold back a ready one. Looking at the shipping page never creates a shipment; it is made when the first bill photo is added or Send is pressed (`/api/m/[token]/orders/[id]/ship-photos`). On a field, the toggle only warns if empty; a step gate is set under Steps.
- **Finished and Archived:** the Finished page has two tabs, like WhatsApp: Finished (completed and cancelled orders) and Archived (put away, kept, out of the main list). Archive moves an order across and remembers what it was (`orders.archived_from`, migration 0006); Unarchive brings it back as the same thing (`unarchiveOrder` in `src/lib/orders.ts`; older archived orders are worked out: anything left unsent means it was cancelled). Archived orders stay hidden from masters.
- **Mandatory fields per step:** in the builder, Admin can tick form fields that must be filled in before a step can be finished (a picture field counts once a picture is attached). Enforced in `completeStage` (`src/lib/stages.ts`) for both master and Admin, shown to the master as a checklist on the step, and cleaned on save so a deleted field never blocks a step. Fields the master cannot edit are marked "you fill this in".
- **Master-editable fields:** masters can type into allowed fields ("Your part" box) and upload pictures to allowed picture fields (`/api/m/[token]/field-photos`); Admin sees a "Master added info" tag.
- **Print/PDF (Phase 4):** one page per category per customer (categories sharing a "print group" name share a page); headings print as bold titles; reference pictures auto-resize; same data drives the on-screen print view and the PDF (`src/lib/print.ts`, `src/lib/pdf.tsx`). Masters get **Download PDF** and Print.
- **Shipping (Phase 5):** master picks items, ticks each as present, uploads the bill (required) and an optional packed-items photo, submits; an item can be in one submitted shipment; order completes when all items shipped; Admin gets a Shipments page and badge.
- **Notifications/reminders (Phase 6):** manual click-to-send WhatsApp links (`wa.me`, text prefilled) for new/changed/cancelled orders, priority raised, photo result, reminders; Reminders page lists overdue / due within 7 days / no progress for 7 days. No automatic sending (WhatsApp Cloud API not built).
- **Admin login:** one password + signed 30-day cookie; `src/proxy.ts` guards `/admin/*` and `/api/admin/*`, and every admin server action and admin route also checks (`requireAdmin`/`isAdmin`); 5 wrong tries locks for 5 minutes.
- **Admin shell:** sidebar with Home dashboard, Customers, Categories (expands to list categories; "+ New category" goes to a page that opens the builder), Photos to check, Reminders, Shipments, Masters, Finished, Log out.

## Code map
- `src/db/schema.ts` (tables + `FieldDef`/`StageDef` types), migrations in `drizzle/` (generate with `db:generate`, never hand-edit).
- `src/lib/`: `orders`, `masters`, `templates` (builder JSON parsing), `items` (field validation/display), `stages` (step + photo gate), `shipping`, `print`, `pdf`, `reminders`, `notify`, `whatsapp`, `storage`, `photo-upload`, `pin` (hash + rate limit), `admin-session`/`admin-auth`, `colour`, `config`.
- `src/app/admin/*` admin screens + server actions; `src/app/m/[token]/*` master screens; `src/app/api/{admin,m}/*` uploads, image serving, PDFs.
- `src/components/`: `FormBuilder` (client drag-and-drop), `AdminSidebar`, `OrderEditor` (client, "Submit anyway" flow), `FieldRow` (renders any field type), `MasterItemFields`, `MasterStages`, `PhotoUpload`, `ui.tsx` (shared classes), `Icon`.
- Tests: `src/lib/*.test.ts` (45 tests; priority, isolation, photo gate, shipping, print/PDF page counts, field types, builder JSON, login session).

## Look and feel
- Theme follows the user's reference screenshot (OrderSys style): light sidebar with a dark active tab, bold navy headings, thin-bordered white cards, lavender progress bars. Admin has the sidebar (slide-out menu on phones); masters get the same colours and fonts with no sidebar.
- Tokens and the daisyUI `tailor` theme are in `src/app/globals.css`; `.panel` is the basic card (kept in `@layer components`, and the quiet default border colour in `@layer base`, so Tailwind classes like `border-l-thread` can override them). One system font, no dark mode, no web fonts.
- Rules: 56px buttons, status shown in words as well as colour, big position-number tile on order cards, no gradients/shadows/animation. Print pages stay black and white.
- The `frontend-design` skill (Anthropic, Apache-2.0) is installed in `.claude/skills/frontend-design/`; our rules above override its taste for expressive pages.

## Gotchas learned
- After changing `src/db/schema.ts`, run `db:generate` + `db:migrate` **and restart the dev server** (it keeps the old schema module and crashes with "undefined").
- `npm run build` overwrites `.next`: stop the dev server first, then delete `.next` and restart after building.
- Only stop this project's own dev server (check the command line contains `order-tracker`); never kill every `node.exe`.
- npm 12 blocks install scripts by default; the native packages used here (`better-sqlite3`, `sharp`) work without approval.
- `@react-pdf/renderer`, `sharp`, `better-sqlite3` must stay in `serverExternalPackages` (`next.config.ts`).
- `cacheComponents` is intentionally off (all pages are live data; `force-dynamic` layouts).
- The browser tool cannot pick files and screenshots time out sometimes; upload routes were tested with `curl` and a session cookie, camera buttons are untested.
- In long shell heredocs, quote/escape slips happen; for big edits write a small script file or use the Write/Edit tools.

## Not done / still open
- **Open questions:** #5 (WhatsApp automatic via Cloud API?), #6 (retention), #10 (offline), #12, #14 (voice notes), #15 (units; each number field has its own free-text unit), #16 (hosting and who pays), #17 (go-live minimum), #19 (what "the bill" is). See `docs/08-open-questions.md`.
- Not built: automatic WhatsApp sending and any scheduled job, voice notes, offline/PWA caching, drag-and-drop for steps (up/down buttons only), removing an item from an existing customer, hard delete, archive retention.
- Untested: real phones (camera upload, touch drag, print preview, layout), real printers.
- Production needs: persistent disk for `data/` (database + uploads) with nightly backup, the three env vars above, HTTPS.
- Demo data in `data/` (test masters Naseem PIN `1234A` and Bilal PIN `5555`, sample customers, sample categories). Reset by deleting `data/` and running `npm run db:migrate`.

## Always loaded
- @docs/01-product-overview.md
- @docs/05-business-rules.md
- @docs/08-open-questions.md
- @docs/09-glossary.md

## Read when relevant
- docs/02-users-and-permissions.md
- docs/03-data-model.md
- docs/04-screens-and-flows.md
- docs/06-tech-stack.md
- docs/07-build-phases.md

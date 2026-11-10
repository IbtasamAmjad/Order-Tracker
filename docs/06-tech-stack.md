# 06 - Tech Stack

Single Next.js (TypeScript) app, SQLite, one small server. Lightweight, matching Anas's request, and well suited to AI-assisted ("vibe") coding. **These are decided; do not swap without asking.**

## Application type
Web application, built as a **PWA**. No native mobile app. Masters only have a phone, Chrome and WhatsApp, so a link is the easiest delivery. "Add to Home Screen" gives an app-like icon.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js + React + Tailwind CSS | Fast mobile-first UI; one app for admin and master |
| Backend | Next.js API routes / server actions | One codebase, nothing extra to maintain |
| Database | SQLite via Drizzle ORM | Single file, safer than a text file for concurrent edits, easy to back up |
| Templates and values | JSON columns | Admin can add categories and fields with no schema change |
| Dynamic forms | React Hook Form + Zod, generated from template JSON | Gives required-field warnings and "submit anyway" |
| Reordering | Up/down buttons first; dnd-kit later | Buttons are more reliable on phones |
| Image compression | `browser-image-compression` (client side) | Fixes 5-10 MB phone photos before upload |
| File storage | Server disk (persistent volume) first; Cloudflare R2 later | Cheap, simple, swappable |
| Thumbnails | Generated on upload (e.g. sharp) | Fast lists on slow connections |
| Print / PDF | Print-specific CSS (`window.print`) for screen printing, plus a **Download PDF** button (react-pdf or Puppeteer) by Phase 4 | One page per item, auto-resized pictures; masters need a PDF file to send to a print shop |
| Admin auth | Auth.js (simple password) | Only Anas (and maybe his wife) |
| Master access | Random token in URL (nanoid) + hashed PIN with attempt limiting | Matches the "personal link + code" design |
| WhatsApp | Phase 1: `wa.me` click-to-send links with prefilled text; later: WhatsApp Cloud API | Free to start; official API needs a Meta business account and approved templates |
| Reminders | Server cron / scheduled job | Overdue and stale flags |
| Hosting | Railway, Render or Fly.io with a **persistent volume**, or a small VPS; Cloudflare in front | SQLite and uploads need persistent disk |

## Image storage design
- Files are **not** in the database. The DB stores a row (see `03-data-model.md`), and the file lives in storage.
- All file access goes through **one storage module** (`save`, `get`, `delete`) so server disk can be swapped for R2 without touching the rest of the code.
- Files are saved with random names, never the original file name.
- Accept JPEG, PNG, WebP only; cap about 2 MB after compression.
- Serve images only after checking the master token (or signed short-lived URLs). No public file listing.
- Estimate: about 300 photos/month at about 300 KB = roughly 90 MB/month, about 1 GB/year.
- Back up the database **and** the uploads folder together (nightly).
- Ensure the host does not wipe the disk on redeploy.

## Constraints that shape the code
- Cheap Android phones and weak internet: small pages, compressed images, minimal client JavaScript beyond React.
- Very basic users: large touch targets, English-only, mostly read-only master views.
- Light security, but hash PINs and rate-limit.
- Scale is small. Do not add queues, microservices or heavy infrastructure.

## Alternatives considered
- **Django + HTMX:** strong alternative (built-in admin, very light pages), but the dynamic form builder and photo-approval UI are smoother in React.
- **Off-the-shelf Kanban tools (Monday, Trello):** rejected by the stakeholder; not per-customer/per-item, not suited to low-literacy users.
- **Firebase / Supabase:** workable but adds accounts and cost for no real benefit at this scale.
- **Plain text-file storage** (suggested in the meeting): rejected in favour of SQLite because concurrent writes can corrupt a text file. SQLite is still a single file.

## Possible future changes
- Move to Postgres if SQLite is outgrown (same ORM).
- Native wrapper only if offline-heavy use or many more users appear.

## Running it on a local office PC
The app can run on an ordinary Windows PC that stays on: `npm run build`, then `npm run start -- -H 0.0.0.0 -p 3000`, with the data (`data/app.db` and `data/uploads`) on the PC's disk. Helper scripts live in `deploy/windows/` (prepare the PC, start at boot, nightly backup, update, restart). Phones on the office Wi-Fi use the PC's fixed address over plain `http://`; masters outside the office need an `https://` address, for which a Cloudflare Tunnel on the client's domain is the suggested free way (no router changes). Login cookies are marked `secure` only when `APP_URL` starts with `https://`. When the PC is in another country from its users (for example the USA and Pakistan), the tunnel is required and the PC's Windows time zone must be set to the users' time zone, because the app shows dates and times in the server's time zone. The step-by-step guide is the Claude Doc "Running Custom Order Manager on a Local Office PC".

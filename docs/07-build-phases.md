# 07 - Build Phases

Adnan and Muhammad both said to **start small** ("let's start simple, like a task list first with priority and username, then layer in the rest"). Build **one phase at a time**. Do not start a phase until the previous one is accepted. Do not build ahead.

Reminder: Anas will test everything himself first and will not release a half product to masters. Masters are onboarded only once the agreed go-live minimum is built (see open question 17).

---

## Phase 1 - MVP: orders, priority, master links
**Goal:** replace the WhatsApp PDF list with a live, ordered list per master.

**Scope**
- Project scaffold, SQLite + Drizzle, deploy to a test server.
- Admin sign-in (simple password).
- Create / edit orders with: customer name, order number, My due date, Karigar due date, free-text details, assigned master.
- Masters: create master, generate personal link and PIN.
- Master PIN screen and dashboard showing only assigned orders in priority order.
- Admin order list with **move up / move down**; sequence renumbers.
- Colour bands (red / green / blue) by priority or due date.
- Master can open an order (read-only) and mark it complete.
- Cancel and archive (no hard delete).
- "Seen" indicator for Admin; New / Updated / Moved up badges for masters.

**Done when**
- Anas creates 3 orders for 2 masters, moves order 3 to position 1, and each master sees only their orders in the new sequence via their own link and PIN.
- A master cannot see My due date, cannot reorder, and cannot see the other master's orders.
- Cancelling an order shows "Cancelled" on the master's dashboard.
- After a master opens an order, Anas sees it as seen; after Anas edits or moves it up, the master sees "Updated" or "Moved up".
- Works on a low-end Android phone in Chrome.

---

## Phase 2 - Templates and forms
**Goal:** end the 30-40 minute manual entry.

**Scope**
- Category and sub-category management (Men > Sherwani, etc.).
- Template builder: fields (text, number, date, picture placeholder, yes/no), required/optional, order.
- Order creation: tick items, fill each item's template form.
- Required-field warning with **Submit anyway**.
- Order detail pages for masters showing all item data.
- Template snapshot per order item.

**Done when**
- Anas creates a Sherwani template with at least 9 measurements, then adds an Indo-western sub-category without a developer.
- An order with Sherwani + Kurta + Pants + Shoes (no Pagri) is created from templates.
- Leaving sleeve length empty shows the warning and allows "Submit anyway".
- Editing the template later does not change existing orders.

---

## Phase 3 - Photos and approval gate
**Goal:** no garment moves on without a checked photo.

**Scope**
- Stage definitions per template, with **photo required** flag.
- Camera upload with client-side compression and thumbnails.
- Storage module (server disk), access checked by token.
- Admin review queue: approve / reject with comment.
- Stage locking and unlocking; master sees status and comments.
- Reference-picture upload by Admin.

**Done when**
- A photo-required stage cannot be completed by the master until the photo is uploaded and approved.
- A 6 MB phone photo is stored at about 400 KB or less.
- Rejection shows Anas's comment to the master, who can re-upload.
- Master A cannot open Master B's image URL.

---

## Phase 4 - Print / PDF
**Goal:** replace the internet-cafe PDF printing.

**Scope**
- Print layout: one page per item type per order.
- Configurable page-sharing (for example Pagri + Shoes).
- Auto-resized pictures.
- Print button for masters and Admin; **Download / share PDF** that a master can send on WhatsApp to a print shop.

**Done when**
- A Sherwani + Kurta/Pants + Pagri/Shoes order prints on the expected number of pages, with measurements and shrunken pictures on one page each, from a phone browser, and the same pages download as one PDF file.

---

## Phase 5 - Shipping checklist and bills
**Goal:** no more shipments with missing items.

**Scope**
- Master selects items being dropped off, ticks each as present.
- Bill upload; submit blocked until the bill exists.
- A bill can cover multiple items.
- Admin sees a copy of each bill and shipment.
- Optional photo of the packed items.
- Partial shipments; an item can be in only one submitted shipment.
- Order becomes completed when all its items are shipped.

**Done when**
- Submitting without the bill is blocked.
- Submitting a 5-Sherwani shipment with one bill records all five.
- Admin can open the bill from the order.

---

## Phase 6 - Notifications and reminders
**Goal:** keep masters moving without phone calls.

**Scope**
- WhatsApp click-to-send links with prefilled text (new order, approval result, order cancelled, priority raised).
- Admin alerts for photos waiting for review and shipments submitted.
- Overdue and stale-order colour flags.
- Reminder job (for example one week before due, or no update).
- Optional: WhatsApp Cloud API automation (only if Anas accepts the setup cost).

**Done when**
- A new order produces a ready WhatsApp message to the assigned master.
- Overdue and stale orders are visibly flagged.

---

## Later / backlog
- Drag-and-drop reordering.
- Voice-note comments on photos.
- Cloudflare R2 storage and backups.
- Hard delete (Admin only) with a "task redundant" notice to the master.
- Wife's account / ladies' line separation (see open questions).
- Archive retention policy.

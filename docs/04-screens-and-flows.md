# 04 - Screens and Flows

All screens are mobile-first, English only, with big buttons. "It doesn't have to be pretty, just functional."

## Admin screens

### A1. Order list (home)
- All active orders in **priority sequence** (1, 2, 3...).
- Each row: order number, customer name, assigned master, both due dates, current progress, colour band.
- Colour coding: **red = urgent**, **green = coming due**, **blue = low priority** (final thresholds to confirm).
- Move up / move down buttons on each row (drag and drop later). Moving an order up makes it more urgent.
- **Seen** tick per order showing whether (and when) the master opened it. This replaces the WhatsApp "read" tick Anas uses today.
- Badge counts: photos waiting for review, shipments submitted.
- Filters: master, status. Button: New order.

### A2. Create / edit order
1. Enter customer name, order number, **My due date**, **Karigar due date**, and assigned master.
2. Tick which items this order needs (Sherwani, Kurta, Pants, Pagri, Shoes, Shawl, Vest...). Unticked items are skipped, and the same item can be added twice.
3. For each ticked item, the app shows that item's **pre-built template form** (design number, fabric, colour, embroidery notes, measurements, reference picture...).
4. On save, if any item field is empty the app lists what is missing, for example "You haven't given sleeve length", and saves nothing until it is filled.
5. Saving adds the order at the end of the priority sequence and may notify the master.

### A3. Template builder
- Create, rename and delete main categories and sub-categories (Men > Sherwani, Ladies > Sharara, Shoes, Bomber jackets, Toys...).
- Per sub-category: add, remove and reorder fields. Field types: text, number, date, picture, yes/no.
- Per field: required or optional.
- Per stage: add, remove and reorder, and mark **photo required**.
- Must be easy: Anas should add a new sub-category such as Indo-western without a developer.

### A4. Review queue
- Photos waiting for approval, newest first, with order and item context.
- Actions: **Approve**, **Reject** with comment. A voice note was floated (later).
- Approval unlocks the next stage and notifies the master.

### A5. Masters
- Create or deactivate a master, generate the personal link, set or reset the PIN.
- Button to copy a prefilled WhatsApp message with the link.

### A6. Archive
- Completed and cancelled orders, read-only, rarely used.

## Master screens

### M1. PIN screen
Open the personal link, enter the personal code (one large input; numbers and letters allowed, e.g. `1234A`), and go to the dashboard.

### M2. Dashboard
- The master's assigned orders in **Anas's sequence**.
- Cannot reorder. Priority shown by colour band.
- Row: customer name, **Karigar due date** only, current stage, item count.
- Badges: **New** (not opened yet), **Updated** (Admin changed details or the Karigar due date since the master last looked), **Moved up** (priority raised).
- Cancelled orders show "Cancelled" until they time out.

### M3. Order detail (read-only)
- Item boxes: each item (Sherwani, Kurta...) shows its heading and description, all field values, all measurements, and reference pictures.
- Measurements appear in a compact card that fits one phone screen, so the master can **screenshot it and send it to a karigar** on WhatsApp (Anas asked for this).
- Buttons: Print, Open stage actions.

### M4. Stage actions
- Shows the current stage for an item.
- If the stage requires a photo: **Take / upload photo** (camera opens directly), then the status shows "Waiting for approval".
- After Admin approves, a **Mark complete** button appears and the next stage unlocks.
- If rejected: the comment is shown and the master uploads again.

### M5. Shipping checklist
- Finished items of all the master's customers are in his **cart** automatically; he can take out any he is not sending today.
- Tick each item to confirm it is physically present.
- Optionally take a photo of the packed items as proof.
- Upload the **bill** for that shipment.
- **Submit** only works once all ticked items are confirmed and the bill is uploaded.

### M6. Print / export
- Prints or exports PDF: **one page per item type per order**.
- Admin can configure which items share a page (for example Pagri + Shoes), to save printing cost.
- Measurements and attached pictures **auto-resize** to fit one page.
- Print-friendly black and white layout.
- **Download / share PDF** button. Masters often print at an internet cafe or print shop, so they need a PDF file they can send on WhatsApp, not only the phone's print dialog.

## Key flows

### Create and assign an order
Admin creates order -> ticks items -> fills templates -> assigns master -> order joins end of sequence -> master gets WhatsApp message (optional) -> master sees it on dashboard.

### Reprioritise
Admin moves an order up -> sequence renumbers -> master's dashboard re-sorts, and the order shows as urgent. Admin can also change due dates; the change is reflected immediately.

### Photo gate
Master completes work -> uploads compressed photo -> status `pending` -> Admin approves or rejects with comment -> if approved, next stage unlocks and the master is notified; if rejected, the master re-uploads.

### Shipping
Finished items go into the master's cart (all customers) -> he uploads one bill -> submits -> Admin receives a copy of the bill and the shipment record. Checkout stays blocked until the bill is uploaded.

### Cancel an order
Admin sets the order to cancelled -> master sees "Cancelled, stop work" and is notified (they may be mid-work) -> it later moves to archive. It is never hard-deleted.

### Admin alerts
Admin is alerted when a photo is waiting for review and when a shipment is submitted (badge in the app; WhatsApp optional).

### Reminders
If an order is overdue or has had no update for a set period (for example a week), it is flagged in colour, and optionally a reminder is sent to the master.

### Remake
Admin opens the customer, opens **Remake items**, ticks the items that must be made again, writes why, and presses **Send back for remake**. The order goes active again (late, because the due date is unchanged), the master is told through the usual WhatsApp banner and sees a "Remake" tag and the reason. When the item is finished again it goes into the master's cart and is sent in a new shipment.

### Customers list
Filter chips (overdue, urgent, coming due, on time, work stages) plus **Sort by due date** (earliest Karigar due date first; the up/down arrows rest while it is on). The up/down arrows swap an order with the one next to it in the list, whatever its master. An overdue order's whole card turns red (red-tinted background and border, a glowing red dot), not only its due date box.


## Items page order
Admin can drag the categories of a group (Kurta, Pants...) into any order with the dots handle; the order is saved at once and also used in the sidebar and when choosing items for a customer.

## Order PDF
Customer form: "Order PDF" box under the masters (choose a PDF, saved with the customer; View and Remove for saved ones). Master order page: "Order PDF" with a View button per file.

The Masters page shows each master as a card: name and status, progress (items, made, percent), his link with Copy, Send link on WhatsApp, Set PIN, New link, Deactivate, Delete.

## Item builder additions (12 Nov 2026)
- Group of boxes: per box a name, "Words or numbers" / "Numbers only", and "Pictures next to it". A plain field has a "What can be typed" box.
- "Copy fields from another item" in the builder; "Make a copy" at the bottom of an item page; "Copy this group with its items" on the Items page.

## Drafts and Send (12 Nov 2026)
- New customer: "Save, send later" (draft) or "Save and send to master". Saving a draft goes back to the Customers list with a "Draft saved" notice; on a draft's page there are "Save draft" and "Send to master". The Customers list tags drafts "Draft, not sent" and has a Drafts chip.

## Notes pictures and Paragraph (12 Nov 2026)
- Under "Extra notes for this customer" there is always a picture box; saved pictures can be removed. The master sees them under the notes.
- The item builder has a "Paragraph" tile (free writing, pictures switched on from the start).

- Fields that allow pictures show a small + at the end of the box (same row); chosen pictures appear below it. Ctrl+V works in the box.

## Compact customer form (12 Nov 2026)
- Customer details three to a row, Order PDF on one row, the item picker one row per group, item fields in a grid (numbers four to a row, text three, long writing two). The notes box shares its row with the picture +.

- Admin customer page: an item's steps are shown side by side as numbered boxes with a status colour on top; an opened box takes the whole row.

- Item builder: "All fields at once" switches Warn if empty and Master can fill on or off for every field. Only fields with Warn if empty get a red * on the customer form and block sending.

- Measurement fields accept words as well as numbers; the unit (No unit, Inches, Meters, Centimetres) is chosen per field in the item builder.
- Picture fields on the customer form have a dashed spot: on a phone press and hold, then tap Paste; on a computer click and press Ctrl+V; or drop a file on it.
- A picture pasted into any text or number box on the customer form stays under that box (also for the master and in print). A sent customer's page has the WhatsApp buttons to tell each master about the new or changed order.
- On the customer form a field with pictures is framed, with its pictures right under its own box.
- Steps have a "Should take N days once started" box (item builder custom steps and the saved steps editor). The office sees the finish date and "Late by N days"; the master sees only the days.
- Masters page: "Your WhatsApp number" box. Master order page: "Ask the office a question" button (also the customer name) opens WhatsApp to the office with the order named and a link.
- Item builder: "From the order" tiles Customer name, Order number, Design number and Delivery date (start filled from the order; the office can change them).
- Master order page: empty fields are hidden; a "Warn if empty" field that is empty shows its name with a blank box.
- Master home: the whole order card opens the order (no Open order button).
- A text box takes several lines (Enter = new line; pasted lines stay apart) and the master sees each line on its own line.
- The printed measurements table holds number and word boxes together in form order; a unit is added only after a plain number.
- Printed sheet / PDF: each item ends with a "Cut here - tailor slip" box (customer name, order number, measurements in short names, notes, no dates). Builder: short name per measurement box, a Notes line tile, and a notes line option on a group of boxes.
- A field that has pictures takes a full row on the customer form (field on top, pictures under it).
- Customer form: back to the earlier look (two columns, larger labels); the new features stay.
- Sending with a "Warn if empty" field still empty: the first press shows the list and sends nothing, the next press sends anyway.

## Design Category (13 Nov 2026)
- Sidebar: Design Category, after Masters. The page has an "Add a design" form (design number, notes, pictures) and a grid of design cards; a card opens its edit page (change the number or notes, add or remove pictures, hide from the customer form).
- Customer form: the item's **Design number** box is a dropdown of these design numbers, with the chosen design's pictures shown small under it. Press Save and the pictures are copied onto the item. The master sees them as "The design the customer chose"; print and PDF include them.

- Customers list (13 Nov 2026): the small "Steps N of M" progress card on each customer card was removed by request; the "Fields" card and everything else stay. The master home cards still show "Steps N of M" as a pill.

- Pictures (13 Nov 2026): every picture the office adds has a cross to remove it (waiting, saved under a field, under the notes, in a design). The master has none: he cannot delete.

- Print and PDF with pictures (13 Nov 2026): a short answer with up to 3 pictures stays in the measurements table with its pictures small inside its box; the PDF draws the table row by row; the Pictures block can continue on the next page.

## Measurement layout like the tailor's sheet (13 Nov 2026)
- The tailor slip at the bottom of the printed order copies the tailor's own paper: "Customer Name X   Item Measurements", then rows of names (underlined) with the value under a line and a small note under a box if there is one. The main sheet keeps its ruled table. Row size is set in the item builder ("Boxes in one printed row" on the Measurements heading or group, "Starts a new row" on a box). On the customer form every measurement box can have a small note under it (for example Add 1 inch); the master sees it under the box.

## Printed slips (14 Nov 2026)
- Item builder, below the Steps: "Printed slips". A dropdown chooses what the printed order has at the bottom of each item: Tailor slip (default), Karigar paper, Both, or No slip. For the karigar paper the office drags the boxes of the form into rows (Add a row; boxes in "Not used" do not print). The printed order then has a second cut-off paper: the customer name and order number, then rows of short names (underlined) with the value under each, for the master to copy by hand.

- Links for masters (14 Nov 2026): on the client's machine https is served on the same port 3002 (`deploy/linux/setup-https.sh`, undo with `rollback-https.sh`); `APP_URL` is the https address, so WhatsApp links are blue and open when tapped. Everybody, the office included, then uses the https address.

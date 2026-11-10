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
Filter chips (overdue, urgent, coming due, on time, work stages) plus **Sort by due date** (earliest Karigar due date first; the up/down arrows rest while it is on). The up/down arrows swap an order with the one next to it in the list, whatever its master. Overdue orders have a glowing red dot.


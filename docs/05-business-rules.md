# 05 - Business Rules

These are the rules that come directly from the stakeholder (Anas) and are easy to get wrong. Each is a plain statement. Treat them as requirements.

## Orders and fields
1. Only these are built in on an order: order number (auto), customer name, **My due date**, and **Karigar due date**. Anas called the two due dates "the only thing hard-coded". Everything else comes from templates.
2. **My due date is visible to Admin only.** The master only sees the Karigar due date.
3. Customer name is **not unique** (many customers share a name). Never use it as an identifier; use the order number.
4. The primary identifiers Anas cares about are **order number and due date**, not product.
5. The app is for **custom orders only**.
6. One order can contain many items; Admin ticks only the items needed. The same item type can appear twice.

## Templates and flexibility
7. Admin can create, edit and delete categories (two levels: main > sub), fields and stages without a developer.
8. Field types supported: text, number, date, picture, yes/no. This is "within reason".
9. Each field is **required or optional**, set by Admin.
10. Every item field marked **"Warn if empty"** that is left empty is listed in a warning the **first** time the office tries to send an order (for example "You haven't given sleeve length"); nothing is sent then. Pressing Save / Send again sends it anyway (changed 13 Nov 2026: warn once, then go through). A field without the flag never warns; pictures, headings and notes are excepted; an attached PDF skips the warning. A draft can be saved with fields empty (rule 70). (Changed from "warn, then submit anyway", then from "every field" to "marked fields only" on 12 Nov 2026.)
11. Templates are **pre-created** so Anas never re-enters the same fields; an order takes 30-40 minutes today and this must shrink.
12. Number of measurements can change over time (6 today, 9 later); templates must allow this.
13. Editing a template must not break existing orders. Finished, cancelled and archived customers keep their own snapshot. Customers **in progress** follow the item automatically when it (or its steps) is saved: what is filled in stays, finished steps stay, the master sees "Updated", and a new field appears empty (if it is marked "Warn if empty" it must be filled before that customer is sent). (Changed from "orders keep a snapshot, press Update from the item".)

## Priority
14. New orders are numbered in the sequence they are added (1, 2, 3...).
15. **Only Admin** can change the sequence. Masters cannot reorder.
16. Moving an order up makes it **urgent**. The master's dashboard is sorted by this sequence, **not** by delivery date.
17. Delivery date is important, but Anas sometimes sets an earlier internal date and then moves the order up himself.
18. The app exists to stop masters choosing work by profit. Masters must follow the list and tick items off in order. Whether the app should **block** work on lower-priority orders, or only show the sequence, is undecided (see open questions).

## Photo gate
19. Admin decides per stage whether a photo is **required**, optional, or not needed.
20. If a stage is photo-required, the master **cannot complete it** and the next stage stays locked until a photo is uploaded **and approved by Admin**.
21. Admin can **approve or reject** with a comment; the master must be notified of the result.
22. If a photo is optional, the master may skip it.
23. Photos are **compressed on the phone before upload**. Target about 200-400 KB (long side about 1600 px). 5-10 MB originals are not acceptable on Pakistani connections.

## Visibility and security
24. A master sees **only** orders assigned to them. One master must never see another's orders or links.
25. Access is by **personal URL plus PIN**; no usernames and no password login for masters.
26. Masters can add and update (upload, tick); they cannot delete anything.
27. Security is intentionally light, but PINs are hashed, tokens are long and random, and attempts are rate-limited.

## Deleting and cancelling
28. **No hard delete** in early versions. Orders are **cancelled** (master sees "Cancelled") and then **archived**.
29. A cancelled order eventually "times out" from the master's view.
30. Archived orders are rarely opened; they only need to be kept out of the way.

## Reminders and colours
31. Overdue or stale orders are **colour-coded**. A reminder (for example one week before the due date, or when not updated) is wanted.
32. WhatsApp notifications are wanted **if achievable without much effort**.

## Shipping
33. The master builds a **checklist** of items being dropped off and confirms each is physically present (to avoid missing-item shipments that cost about $100 to resend).
34. The master **cannot submit** the shipment until the **bill is uploaded**.
35. One bill covers all the finished items of all of a master's customers: they wait in the master's **cart**, he takes one bill photo and sends them together. He can take an item out of the shipment that day.
36. Admin receives a copy of the bill.

## Printing
37. Masters must be able to **print / export** order details. This is critical: the printout is attached to the fabric and travels with it through every station.
38. **One page per item type per order** (Sherwani page, Kurta + pants page, Pagri page...).
39. Admin can configure which item types **share a page** (for example Pagri and Shoes), because printing costs about 10 rupees per page.
40. Attached pictures **auto-resize** to fit a single concise page, except the "Reference picture" field, whose pictures always print 52 mm high (14 Nov 2026, by request).

## Usability constraints
41. The end user is **very basic**: click, click, click. English-only UI. Large buttons. Minimal options.
42. Used on phones with Chrome (mostly cheap Android, some iPhone) and WhatsApp.
43. It must be **lightweight**. Scale is 5-10 categories, not hundreds, and about 2-4 masters.
44. Anas will **not release a half product** to masters; he tests it first himself.

## Tracking and changes
45. Admin can see whether and when a master opened each order. Anas relies on the WhatsApp "read" tick for this today.
46. The master's dashboard marks orders as **New**, **Updated** (details or Karigar due date changed) or **Moved up**, so changes are not missed. The master is told to check the link daily.
47. The master's code may contain numbers and letters (e.g. `1234A`).

## Completion and shipping details
48. An order is **completed** when all its items are in submitted shipments, or when Admin marks it complete.
49. Partial shipments are allowed, but an item can be in only **one** submitted shipment.
50. The master can attach an optional photo of the packed items as proof.
51. Admin is alerted when a photo awaits review and when a shipment is submitted.
52. Cancelling an order notifies the master, since they may already be working on it.

## Printing and sharing details
53. Print output must also be available as a **downloadable / shareable PDF**, because masters print at an internet cafe or print shop.
54. The measurement view must be **screenshot-friendly** on a phone, so a master can send it to a karigar on WhatsApp.

## Remake (an item came back wrong)
55. If a delivered item is wrong, Admin sends it back for a **remake** instead of making a new order: one, several or all items of the order, with a required reason.
56. The chosen items start again from their first step; what is filled in stays. The other items stay as they were (sent or in progress).
57. The order keeps its **original due date**, so it shows as late (the late tag and "Overdue by N days"). A completed or archived order becomes active again and moves to the top of the list. A cancelled order cannot be remade.
58. The old shipment and its bill stay in the record, marked as sent back; the remade item is sent again in a new shipment with a new bill. Step photos from before the remake no longer count.
59. The reason is written in the history and shown to the master under the first step ("From the office"); the master sees a "Remake" tag.

## Display rules
60. A colour is shown by its **name** (for example "Maroon"), never as a code, on every screen and in print; the exact colour is still stored.
61. The WhatsApp reminders to a master say in plain words which order it is, the Karigar due date, how late it is, and which items are finished, sent or still to make. They never contain My due date.
62. The master sees, for each order, which items are sent, finished (waiting in the cart) and still to make.
63. A text, long text or number field can allow pictures right under it (for example Embroidery details): Admin switches it on per field in the item form; the office adds the pictures on the customer form and the master sees them as small pictures under that field. The text is still needed if marked "Warn if empty"; a picture does not replace it.
64. The printed order sheet and the PDF are the same: a header with the order, customer, design number and due date in words (never My due date), a divider under every row, measurements in a ruled grid, pictures added under a field printed right under that field, and the item's other pictures (reference pictures) at the end. The pictures of the "Reference picture" field print 52 mm high; the others stay small. The header is repeated at the top of every printed page, also when an item type runs on to a second page.

## Order PDF
65. The office can attach a PDF (for example the customer's own order form) to an order instead of typing every detail. With a PDF attached, the item fields may stay empty; without one, the "Warn if empty" fields are still needed (rule 10).
66. The master can only view the PDF, never add or remove it, and only on his own orders. It is not part of the printed sheet.

67. A master can be deleted only if he never had a customer, shipment or history; otherwise he is deactivated (his link stops, the record stays).

68. In a group of boxes (for example Measurements) each box is either a text box (words or numbers, such as "24 ready") or a number-only box, and can have pictures next to it.
69. Admin can copy the fields of another item into a form, copy a whole item, or copy a whole group with its items; a copy is separate from the original.

70. Saving a customer makes a **draft**: only the office sees it. The master sees it only after the office presses **Send to master**, and then it shows as New. A draft is left out of the master's lists, pending work, items, cart and reminders, and out of the Live board and Home counts. Older orders count as already sent.

71. The notes box of a customer can have pictures (always available, no switch). The master sees them once the order is sent; they are not printed.

72. A picture pasted into a text or number box of an item belongs to that box and is shown next to it for the office and the master and in print; it never moves to another field.

73. A step can have an expected number of days, counted from when the step starts (the step before it is finished). The office sees the finish date and a late flag, and late steps appear on the Reminders page. **The master sees only the number of days, never a date.**
74. A master can send the office a question about an order from the order page: WhatsApp opens with the order number, customer, design, items, Karigar due date and a link to the order already written. It never contains My due date.
75. The customer name, order number, design number and delivery date (the Karigar due date, never My due date) can be put on an item form as automatic fields. They start with the order's value, follow the order until the office changes them, can be edited by the office, are never required, and the date is separate from the name so a forwarded screenshot can leave it out.
76. On the master's screen an empty field is hidden unless it is marked "Warn if empty" (then only its name and a blank box show, so it is clear nothing was given) or it has pictures. Fields the master is allowed to fill still show their box.

77. The printed order has a tailor slip for each item (all of them together on a "Tailor slips" page at the end, 14 Nov 2026; "Download tailor slips" gives only that page, for the office and the master) with the measurements again (short names) and their notes, to cut off and give to the karigar so nobody copies them by hand. The slip never carries a date or price.

78. The office keeps a library of design numbers, each with several pictures (Design Category page). Choosing a design number in the Design number box of a customer's item copies its pictures onto that item, so nothing has to be uploaded again; changing or removing a design later never changes customers that already have it. Another number, or an empty box, takes the pictures off. A design number is in the library once. The master only sees the pictures attached to his customer, never the library.

79. The tailor slip repeats the measurements exactly like the tailor's own sheet: the customer name and "<item> Measurements" on top, rows of boxes (the number in a row is set by the office, and a box can start a new row), the name above the value, and a small note under a box when one was typed (for example "Add 1 inch"). The note is for the karigar, never a date or price.

80. The office chooses per item what the printed order carries at the bottom: the tailor slip, the karigar paper (short names in rows laid out by the office, filled in with the answers), both, or none. A change reaches customers in progress without telling the master, because only the printout changed. The slips never carry a date or price.

81. The office chooses per field whether it is printed on the tailor slip (by default the fields under Measurements are). It can also add the design number, the item's colour and "1 of 2" (when an order has the same item twice) to the slip's header line. Pictures, notes and every date can never be put on the slip. These changes reach customers in progress without telling the master.

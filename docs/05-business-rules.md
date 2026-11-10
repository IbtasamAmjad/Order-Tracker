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
10. Every item field must be filled in before an order is saved, new or old (pictures, headings and notes excepted). If something is empty the app lists what is missing (for example "You haven't given sleeve length") and saves nothing until it is filled. (Changed from "warn, then submit anyway".)
11. Templates are **pre-created** so Anas never re-enters the same fields; an order takes 30-40 minutes today and this must shrink.
12. Number of measurements can change over time (6 today, 9 later); templates must allow this.
13. Editing a template must not break existing orders. Finished, cancelled and archived customers keep their own snapshot. Customers **in progress** follow the item automatically when it (or its steps) is saved: what is filled in stays, finished steps stay, the master sees "Updated", and a new field appears empty and must be filled before that customer can be saved. (Changed from "orders keep a snapshot, press Update from the item".)

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
40. Attached pictures **auto-resize** to fit a single concise page.

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


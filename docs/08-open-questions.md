# 08 - Open Questions

These are **not decided**. Ask the user before building anything that depends on them. Do not guess.

| # | Question | Why it matters | Needed by |
|---|---|---|---|
| 1 | Does Anas's wife (who runs the ladies' line) get her own Admin account, or does everything sit under Anas? Do she and Anas see each other's orders? | Admin auth and data separation | Phase 1 |
| 2 | Are stages the same for every item, or defined per template? (Current assumption: per template.) | Stage model | Phase 2 |
| 3 | Is priority one **global** sequence, or one per master? (Current assumption: one global sequence, shown filtered per master.) | Reorder logic and dashboards | Phase 1 |
| 4 | Exact colour rules: is colour set by Anas manually, by due-date proximity, or both? What are the thresholds? | Colour bands | Phase 1 |
| 5 | Which WhatsApp route is acceptable: manual click-to-send links, or automated messages via the Cloud API (Meta business account, approved templates)? | Phase 6 scope and cost | Phase 6 |
| 6 | How long should archived orders and their photos be kept? | Storage and retention | Phase 3 |
| 7 | Who creates and edits templates: only Anas, or also his wife? | Permissions | Phase 2 |
| 8 | Is each master's PIN set by Anas, or can masters change it? | Master screen | Phase 1 |
| 9 | Should a master's link expire or be re-issuable if lost? | Security | Phase 1 |
| 10 | Do the factories have reliable internet, or is any offline use needed? | PWA caching | Phase 3 |
| 11 | Can **different masters work on different items of the same order** (Sherwani master vs Pagri master)? The meeting mentioned separate karigars per item, but also "one master per order". | Core assignment model: is `master_id` on the order or on the item? | Phase 1 |
| 12 | Are stage completions done by the master only, or can the checker/accountant roles act too? (Meeting said only Admin and Master for now.) | Roles | Phase 2 |
| 13 | Should "cancelled" orders disappear from the master view after a fixed number of days? How many? | Dashboard behaviour | Phase 1 |
| 14 | Voice notes on rejection: wanted now or later? | Scope | Phase 3 |
| 15 | Which units are measurements in (inches, cm), and are they ever mixed? | Template fields | Phase 2 |
| 16 | Delivery: hosting location and budget, and who pays for the server and WhatsApp API? | Deployment | Phase 1 |
| 17 | Which phases are the minimum before masters go live? Anas said he can't give them a half product, while Adnan wants to start small. | Release plan | Phase 1 |
| 18 | Should the app **block** a master from uploading or completing stages on lower-priority orders until higher ones are done, or only show the sequence? (Anas: "till you check off these, I can't do anything".) | Core priority enforcement | Phase 1 |
| 19 | What exactly is the "bill" at shipping: the shipping company's receipt, the accountant's invoice to Anas ("they bill me for every item"), or the challan? One file or several? | Shipping data | Phase 5 |
| 20 | Should the master get a WhatsApp message when Anas moves an order up or edits it, or is the in-app badge enough? | Notifications | Phase 6 |

## Assumptions made in these docs (confirm or correct)
- Priority is one global sequence.
- Master is assigned at **order** level. (The transcript also says the Sherwani, kurta/pants and Pagri go to different karigars, which could mean item-level assignment; see question 11.)
- Stages are defined **per template**.
- Admin is Anas only for now.
- Colours are driven by priority position plus due-date proximity.
- English only, inches for measurements.

## Items intentionally deferred ("worry about it later")
- Hard delete.
- Heavy security.
- Large scale (hundreds of categories).
- Drag-and-drop UI.

## Decisions (answered by the user, 2026-11-04)
- **#11** Master is assigned to the **whole order** (`master_id` on the order, not the item).
- **#1** No separate account for Anas's wife. Single Admin.
- **#8** Admin sets each master's PIN.
- **#9** A lost link can be **re-issued** (Admin generates a new token).
- **#13** Completed and cancelled orders move to their own section on the master's screen, then disappear from the master's view after **15 days**.
- **#16** Hosting and who pays: decide later.
- **#17** Go-live minimum: build everything first, decide later.
- **#3** One global sequence (numbered in the order orders are added). Each master sees only their own orders from it. Admin's move up/down applies among that master's orders.
- **#18** A master can upload photos on any order, but **cannot submit/complete work on an order while an earlier-priority order of theirs is unfinished**, unless Admin explicitly allows that order (per-order override).
- **#4** Order colour bands: red = urgent, green = coming due, blue = low priority, using sensible default rules (see Phase 1 plan). Separately, Admin can give each item type/category a colour in the template section (Phase 2).
- **#2** Stages are defined **per item type** (template), set in the template builder. Photo setting per stage: required / optional / none.
- **Order-level "Mark complete"** stays as it is for now; Phase 5 will complete orders automatically when everything is shipped.
- **#19 (working assumption, not confirmed)** "The bill" is built as **one photo per shipment**, covering all items in that shipment. Confirm with Anas whether it is the shipping receipt, the accountant's invoice or the challan.
- **#5 (working assumption, not confirmed)** WhatsApp is **manual click-to-send** (wa.me links with the message prefilled). The Cloud API automation is not built; if Anas wants it, only `src/lib/whatsapp.ts` needs a new "send" path.
- **#20** Master can be told about moves/edits with a click-to-send message from the order page; the in-app badge also works.

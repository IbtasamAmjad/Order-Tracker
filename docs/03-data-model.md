# 03 - Data Model

Design goal: the **only built-in order fields** are the order number (auto), the customer name and the two due dates. Everything else is defined by Admin through templates, stored as JSON, so Anas can add categories and fields without a code change.

## Entities

### Master
| Field | Notes |
|---|---|
| id | |
| name | e.g. "Naseem" |
| token | long random string used in the personal URL |
| pin_hash | hashed personal code; numbers and letters allowed (Anas's example: `1234A`) |
| whatsapp_number | optional, for notifications |
| active | boolean |

### Order
| Field | Notes |
|---|---|
| id | |
| order_number | human-friendly number, primary goal for Anas |
| customer_name | **not unique** (many customers share a name) |
| my_due_date | **admin-only**; Anas's real delivery date |
| karigar_due_date | shown to the master |
| master_id | assigned master |
| priority_position | integer sequence; lower = more urgent; only Admin changes it |
| status | `active` / `completed` / `cancelled` / `archived`. Completed when every item is in a submitted shipment, or when Admin marks it complete |
| notes | free text |
| master_seen_at | first time the master opened the order (replaces the WhatsApp "read" tick Anas relies on today) |
| master_last_seen_at | last time the master opened the order |
| changed_for_master_at | last time Admin changed anything the master sees (details, Karigar due date, priority raised); drives the "Updated" / "Moved up" badges |
| created_at / updated_at | |

### Category (two levels)
| Field | Notes |
|---|---|
| id | |
| parent_id | null for a main category (Men, Ladies, Shoes, Toys...), set for a sub-category (Sherwani, Kurta, Sharara...) |
| name | |

### Template (one per sub-category)
| Field | Notes |
|---|---|
| id | |
| category_id | the sub-category it belongs to |
| name | |
| fields | JSON array of field definitions (below) |
| stages | JSON array of stage definitions (below) |
| version | integer; filled orders keep a snapshot, so later template edits do not break old orders |
| print_group | optional label; item types with the same label print on one page (e.g. Pagri + Shoes, because the same karigar makes both) |
| active | boolean |

**Field definition (JSON)**
```json
{
  "key": "sleeve_length",
  "label": "Sleeve length",
  "type": "number",
  "required": true,
  "unit": "inch",
  "order": 4
}
```
Allowed `type`: `text` (short), `longtext` (comments), `number`, `phone`, `date`, `time`, `select` (dropdown), `radio` (choose one), `checkboxes` (choose many), `yesno`, `picture`, `heading` (a note, no answer). Choice types carry `options`. Any field can be `required` and can be marked `masterCanEdit` (the master may fill it: comments, pictures, choices). A `text` or `longtext` field can also have `pictures: true`: the office can add pictures right under it (stored in `photos` with that field's key).

**Stage definition (JSON)**
```json
{
  "key": "embroidery",
  "label": "Embroidery",
  "photoRequired": true,
  "order": 2
}
```

### OrderItem
One row per garment/accessory in an order (Sherwani, Kurta, Pants, Pagri, Shoes, Shawl, Vest, a second Sherwani...).
| Field | Notes |
|---|---|
| id | |
| order_id | |
| template_id + template_snapshot | snapshot of fields/stages at creation time |
| label | e.g. "Sherwani 1" |
| values | JSON object of filled-in fields, keyed by field key |
| current_stage | key of the active stage |
| position | order within the order |

### StageProgress
| Field | Notes |
|---|---|
| id | |
| item_id | |
| stage_key | |
| status | `locked` / `open` / `done` |
| completed_at | |
| completed_by | master or admin |

### Photo
| Field | Notes |
|---|---|
| id | |
| order_id, item_id, stage_key | where it belongs |
| type | `reference` (Admin), `stage` (Master), `bill` (shipping) |
| file_key | storage path or key, e.g. `orders/42/embroidery-8f3k2.webp` |
| thumb_key | small version for lists |
| uploaded_by | admin or master id |
| status | `pending` / `approved` / `rejected` |
| comment | Admin's note, e.g. "Wrong silver thread, redo the collar" |
| uploaded_at / reviewed_at | |

The database stores only the record; files live in file storage.

### Shipment
| Field | Notes |
|---|---|
| id | |
| order_id | only where the bill picture is filed (an open order of the master); a shipment can hold items of several orders |
| master_id | the master's open `draft` is his cart; he has one at a time |
| status | `draft` / `submitted` |
| bill_photo_id | the uploaded bill/invoice (required to submit) |
| package_photo_id | optional photo of the packed items (the "snapshot" Anas asked for) |
| submitted_at | |

### ShipmentItem
| Field | Notes |
|---|---|
| shipment_id, item_id | which items are in this drop-off |
| checked | master ticked it as physically present |

A bill can cover many garments from many customers, so a shipment holds many items, each from its own order. Partial shipments are allowed, but an item can belong to only **one submitted** shipment.

### Notification (optional, later)
| Field | Notes |
|---|---|
| id, master_id, type, message, sent_at, channel | `new_order`, `photo_approved`, `photo_rejected`, `overdue` |

## Relationships
```
Master 1---* Order 1---* OrderItem 1---* StageProgress
                    |          |
                    |          *---* Photo
                    *---* Shipment 1---* ShipmentItem *---1 OrderItem
Category 1---* Category (sub) 1---1 Template ---* OrderItem
```

## Example: Sherwani template (JSON)
```json
{
  "name": "Sherwani",
  "category": "Men > Sherwani",
  "fields": [
    { "key": "design_number", "label": "Design number", "type": "text", "required": true },
    { "key": "fabric", "label": "Fabric", "type": "text", "required": true },
    { "key": "colour", "label": "Colour", "type": "text", "required": true },
    { "key": "embroidery_notes", "label": "Embroidery notes", "type": "text", "required": false },
    { "key": "fitting_notes", "label": "Fitting notes", "type": "text", "required": false },
    { "key": "reference_picture", "label": "Reference picture", "type": "picture", "required": false },
    { "key": "chest", "label": "Chest", "type": "number", "required": true, "unit": "inch" },
    { "key": "waist", "label": "Waist", "type": "number", "required": true, "unit": "inch" },
    { "key": "shoulder", "label": "Shoulder", "type": "number", "required": true, "unit": "inch" },
    { "key": "sleeve_length", "label": "Sleeve length", "type": "number", "required": true, "unit": "inch" },
    { "key": "length", "label": "Length", "type": "number", "required": true, "unit": "inch" },
    { "key": "neck", "label": "Neck", "type": "number", "required": false, "unit": "inch" }
  ],
  "stages": [
    { "key": "cutting", "label": "Cutting", "photoRequired": false },
    { "key": "embroidery", "label": "Embroidery", "photoRequired": true },
    { "key": "stitching", "label": "Stitching", "photoRequired": false },
    { "key": "checking", "label": "Checking", "photoRequired": false },
    { "key": "packing", "label": "Packing", "photoRequired": false }
  ]
}
```
The measurement list above is illustrative. Anas said he used 6 measurements and now uses 9, and he will define the real set himself in the template builder.

The accountant's invoice and the handover to the shipping company are handled by the **Shipment** flow, not by template stages.

## Example: filled order (JSON)
```json
{
  "order_number": 1042,
  "customer_name": "Usha (family)",
  "my_due_date": "2026-12-20",
  "karigar_due_date": "2026-12-05",
  "master": "Naseem",
  "priority_position": 3,
  "items": [
    {
      "template": "Sherwani",
      "values": {
        "design_number": "SH-221",
        "fabric": "Silk, ivory",
        "colour": "Ivory with silver thread",
        "chest": 42, "waist": 38, "shoulder": 18, "sleeve_length": 25, "length": 44
      }
    },
    { "template": "Kurta", "values": { "design_number": "KU-09", "fabric": "Cotton" } },
    { "template": "Shoes", "values": { "size": 10 } }
  ]
}
```

## Storage notes
- SQLite file for records; files for images (see `06-tech-stack.md`).
- Template definitions and filled values use JSON columns.
- Keep `priority_position` unique among active orders and renumber on every move.

## categories.position
`categories.position` (integer, default 0) holds the order chosen by dragging on the Items page; lists sort by position, then name.

## order_files
`order_files` (id, order_id, name, file_key, bytes, uploaded_at): PDFs attached to an order; the file is in the uploads folder.

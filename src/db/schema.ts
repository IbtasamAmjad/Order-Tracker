import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

const ts = (name: string) => integer(name, { mode: "timestamp_ms" });

export const masters = sqliteTable("masters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // long random string used in the personal URL
  token: text("token").notNull().unique(),
  // hashed personal code (numbers and letters)
  pinHash: text("pin_hash").notNull(),
  // value stored in the master's cookie after a correct PIN; rotated on re-issue / PIN change
  sessionSecret: text("session_secret").notNull(),
  whatsappNumber: text("whatsapp_number"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

export const ORDER_STATUSES = ["active", "completed", "cancelled", "archived"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderNumber: integer("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(), // not unique
  // each order has its own Design Number (kept in capitals, never used twice). Older orders may not have one yet.
  designNumber: text("design_number").unique(),
  // an accessory or other single item ordered on its own is linked to the Design Number of its main Sherwani or Bridal
  linkedDesignNumber: text("linked_design_number"),
  myDueDate: text("my_due_date").notNull(), // YYYY-MM-DD, admin only
  karigarDueDate: text("karigar_due_date").notNull(), // YYYY-MM-DD
  masterId: integer("master_id")
    .notNull()
    .references(() => masters.id),
  // one global sequence; lower = more urgent; only Admin changes it
  priorityPosition: integer("priority_position").notNull(),
  details: text("details").notNull().default(""),
  status: text("status", { enum: ORDER_STATUSES }).notNull().default("active"),
  // Admin override: master may complete this order before earlier ones
  allowOutOfSequence: integer("allow_out_of_sequence", { mode: "boolean" })
    .notNull()
    .default(false),
  masterSeenAt: ts("master_seen_at"),
  masterLastSeenAt: ts("master_last_seen_at"),
  changedForMasterAt: ts("changed_for_master_at"),
  movedUpAt: ts("moved_up_at"),
  closedAt: ts("closed_at"), // when completed / cancelled
  // what the order was before it was archived, so it can come back out of the archive as the same thing
  archivedFrom: text("archived_from", { enum: ["completed", "cancelled"] }),
  // the master pressed "I have seen this order" (the first step, Order received)
  confirmedAt: ts("confirmed_at"),
  confirmedBy: integer("confirmed_by"),
  masterEditedAt: ts("master_edited_at"), // last time the master changed a field he is allowed to edit
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

// An order can have several masters. orders.master_id stays as the first (main) one; this lists every master of the order.
export const orderMasters = sqliteTable(
  "order_masters",
  {
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    masterId: integer("master_id")
      .notNull()
      .references(() => masters.id),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.masterId] })],
);

// ---------------------------------------------------------------- Phase 2

// Field types the Admin can put on a category form.
export const FIELD_TYPES = [
  "text", // short text
  "longtext", // comments / long answer
  "number",
  "phone",
  "date",
  "time",
  "select", // dropdown list
  "radio", // choose one (buttons)
  "checkboxes", // choose many
  "yesno",
  "color", // a HEX color code, like #1F69D1
  "picture", // photo upload
  "heading", // not an input: a bold heading
  "note", // not an input: a plain line of text / instruction
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

// none: no work image; optional: the master may add images; upload: at least one image must be added (no approval);
// required: an image the office must approve.
export const PHOTO_RULES = ["required", "upload", "optional", "none"] as const;
export type PhotoRule = (typeof PHOTO_RULES)[number];

export type StageDef = {
  key: string;
  label: string;
  photo: PhotoRule; // is a photo needed before the stage can be completed?
  requiresFields?: string[]; // keys of form fields that must be filled in before the stage can be completed
};

export type FieldDef = {
  key: string; // stable id, never changes after creation
  label: string;
  type: FieldType;
  required: boolean;
  unit?: string; // free text, e.g. "inch" or "cm" (number fields)
  options?: string[]; // choices for select / radio / checkboxes
  masterCanEdit?: boolean; // the master may fill or change this field (comments, pictures...)
  pictures?: boolean; // text and long text only: the office can add pictures right under this field (for example Embroidery details)
};

// Two levels: main (parentId null) > sub. Templates hang off sub-categories.
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  colour: text("colour").notNull().default("#64748b"),
  // the order Admin chose by dragging (0 = never moved, then by name)
  position: integer("position").notNull().default(0),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

// A reusable, named workflow: the steps a kind of item goes through (for example Embroidery, Stitching, Final check).
// Item types can use one; editing a workflow updates every item type that uses it (for new customers).
export const workflows = sqliteTable("workflows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  stages: text("stages", { mode: "json" }).$type<StageDef[]>().notNull().default([]),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id").notNull().unique(), // the sub-category
  fields: text("fields", { mode: "json" }).$type<FieldDef[]>().notNull(),
  stages: text("stages", { mode: "json" }).$type<StageDef[]>().notNull().default([]),
  version: integer("version").notNull().default(1),
  // item types with the same print group name share one printed page (e.g. "Pagri + Shoes")
  printGroup: text("print_group"),
  // the workflow this item type uses (its steps are the workflow's); null = its own custom steps
  workflowId: integer("workflow_id"),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

export type ItemSnapshot = {
  templateName: string; // e.g. "Sherwani"
  path: string; // e.g. "Men > Sherwani"
  colour: string;
  version: number;
  fields: FieldDef[];
  stages?: StageDef[]; // missing on items created before stages existed
};

// One garment/accessory in an order. Keeps a snapshot of the template, so later
// template edits never change existing orders. No FK on template_id on purpose:
// deleting a template must not touch old orders.
export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  templateId: integer("template_id"),
  label: text("label").notNull(), // "Sherwani 1"
  snapshot: text("snapshot", { mode: "json" }).$type<ItemSnapshot>().notNull(),
  values: text("values", { mode: "json" }).$type<Record<string, string>>().notNull(),
  position: integer("position").notNull(),
  // set when the office sends the item back for a remake: step photos from before this time no longer count
  remadeAt: ts("remade_at"),
});

// ---------------------------------------------------------------- Phase 3

export const STAGE_STATUSES = ["locked", "open", "done"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

// Progress of one stage of one order item.
export const itemStages = sqliteTable("item_stages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id")
    .notNull()
    .references(() => orderItems.id),
  stageKey: text("stage_key").notNull(),
  position: integer("position").notNull(),
  status: text("status", { enum: STAGE_STATUSES }).notNull().default("locked"),
  completedAt: ts("completed_at"),
  completedBy: text("completed_by", { enum: ["master", "admin"] }),
  // what the office wants done at this step, for this customer's item (the master sees it on the step)
  instruction: text("instruction"),
});

export const PHOTO_STATUSES = ["pending", "approved", "rejected"] as const;
export type PhotoStatus = (typeof PHOTO_STATUSES)[number];

export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  itemId: integer("item_id").references(() => orderItems.id),
  stageKey: text("stage_key"), // for stage photos
  fieldKey: text("field_key"), // for reference pictures (a picture field)
  type: text("type", { enum: ["reference", "stage", "bill", "package"] }).notNull(),
  fileKey: text("file_key").notNull(),
  thumbKey: text("thumb_key").notNull(),
  bytes: integer("bytes").notNull(),
  uploadedBy: text("uploaded_by", { enum: ["admin", "master"] }).notNull(),
  status: text("status", { enum: PHOTO_STATUSES }).notNull().default("pending"),
  comment: text("comment"), // Admin's note on approve / reject
  uploadedAt: ts("uploaded_at")
    .notNull()
    .$defaultFn(() => new Date()),
  reviewedAt: ts("reviewed_at"),
});

// PDF files attached to an order (for example the customer's own order form), so the details need not be typed in.
export const orderFiles = sqliteTable("order_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  name: text("name").notNull(),
  fileKey: text("file_key").notNull(),
  bytes: integer("bytes").notNull(),
  uploadedAt: ts("uploaded_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------- Phase 5

export const SHIPMENT_STATUSES = ["draft", "submitted"] as const;

// One drop-off to the shipping company. One bill (photo) can cover many items.
export const shipments = sqliteTable("shipments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  masterId: integer("master_id")
    .notNull()
    .references(() => masters.id),
  status: text("status", { enum: SHIPMENT_STATUSES }).notNull().default("draft"),
  billPhotoId: integer("bill_photo_id"), // required to submit
  packagePhotoId: integer("package_photo_id"), // optional photo of the packed items
  submittedAt: ts("submitted_at"),
  adminSeenAt: ts("admin_seen_at"), // null = Admin has not looked at it yet (drives the badge)
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

export const shipmentItems = sqliteTable("shipment_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shipmentId: integer("shipment_id")
    .notNull()
    .references(() => shipments.id),
  itemId: integer("item_id")
    .notNull()
    .references(() => orderItems.id),
  checked: integer("checked", { mode: "boolean" }).notNull().default(false), // master confirmed it is physically there
  returnedAt: ts("returned_at"), // the item came back wrong and is being remade: this line no longer counts as sent
});

// ---------------------------------------------------------------- production history

export const EVENT_KINDS = ["confirmed", "done", "note", "instruction", "image", "shipped", "remade"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

// The history of an order: who did what and when. Never edited or deleted.
// confirmed: the master saw the order. done: a step was finished. note: a note or comment on a step.
// instruction: the office's instruction for a step. image: work image(s) added to a step. shipped: an item was sent.
export const stageEvents = sqliteTable("stage_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  itemId: integer("item_id").references(() => orderItems.id), // null for the whole order (confirmed)
  stageKey: text("stage_key"), // null when it is not about one step
  kind: text("kind", { enum: EVENT_KINDS }).notNull(),
  by: text("by", { enum: ["master", "admin"] }).notNull(),
  masterId: integer("master_id"),
  text: text("text"),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

import type { ReactNode } from "react";
import type { FieldDef } from "@/db/schema";

/** State returned by the order save action (used with useActionState). */
export type EditorState = {
  nonce: number;
  /** Required fields left empty, e.g. "Sherwani: Sleeve length". Empty = nothing to warn about. */
  missing: string[];
  /** Everything the user typed, so the form can be shown again unchanged. */
  values: Record<string, string>;
  error?: string;
};

export const emptyEditorState: EditorState = { nonce: 0, missing: [], values: {} };

export type EditorItem = {
  key: string; // new items: "n0", "n1"...; existing items: the item id
  templateId?: number; // only for new items
  label: string;
  colour: string;
  fields: FieldDef[];
  values: Record<string, string>;
  /** existing items only: may Admin remove it? false when it was already sent in a shipment */
  removable?: boolean;
  /** existing items only: the item's steps and shipping state, shown inside its card */
  extra?: ReactNode;
  /** existing items only: one line for the closed card, like "3 of 11 fields filled. Now: Stitching" */
  summary?: string;
  /** existing items only: fields filled out of all fields, for the small chip beside the name */
  progress?: { filled: number; total: number };
  /** existing items only: a few key answers (the measurements) shown as a strip on the card */
  facts?: { label: string; value: string }[];
  /** existing items only: the pictures already saved on the item, by field */
  photos?: { id: number; fieldKey: string }[];
};

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
};

"use client";

import { Icon } from "./Icon";

/**
 * A small cross on the top of an item's card: remove this item from the customer. It sits inside the customer form but sends to the separate remove form on the
 * page (form="remove-item-form"), after asking "are you sure?".
 */
export function RemoveItemButton({ itemId, label }: { itemId: string; label: string }) {
  return (
    <button
      type="submit"
      form="remove-item-form"
      name="itemId"
      value={itemId}
      title="Remove this item"
      aria-label={`Remove ${label}`}
      className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-bad hover:bg-bad-soft"
      onClick={(e) => {
        if (!window.confirm(`Remove ${label} from this customer? Its steps and pictures are removed too. This cannot be undone.`)) e.preventDefault();
      }}
    >
      <Icon name="close" className="h-5 w-5" />
    </button>
  );
}

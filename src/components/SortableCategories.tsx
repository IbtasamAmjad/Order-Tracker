"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "@/components/Icon";
import { reorderCategoriesAction } from "@/app/admin/templates/actions";

export type SortableCategory = { id: number; name: string; colour: string; templateId: number; fieldCount: number };

function Row({ c }: { c: SortableCategory }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="flex items-stretch gap-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Move ${c.name}`}
        className="flex w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-[var(--radius-card)] border border-rule bg-white text-muted active:cursor-grabbing"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
          <circle cx="7" cy="5" r="1.6" /><circle cx="13" cy="5" r="1.6" />
          <circle cx="7" cy="10" r="1.6" /><circle cx="13" cy="10" r="1.6" />
          <circle cx="7" cy="15" r="1.6" /><circle cx="13" cy="15" r="1.6" />
        </svg>
      </button>
      <Link
        href={`/admin/templates/${c.templateId}`}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 panel text-xl font-medium"
      >
        <span className="inline-block h-5 w-5 rounded-full" style={{ background: c.colour }} />
        <span className="min-w-0 flex-1 basis-24 break-words">{c.name}</span>
        <span className="flex items-center gap-2 text-base font-normal">
          {c.fieldCount} fields
          <Icon name="arrow" className="h-4 w-4" />
        </span>
      </Link>
    </li>
  );
}

/** The categories of one group; drag the dots to change their order (saved at once). */
export function SortableCategories({ parentId, items }: { parentId: number; items: SortableCategory[] }) {
  const [list, setList] = useState(items);
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = list.findIndex((c) => c.id === active.id);
    const to = list.findIndex((c) => c.id === over.id);
    const next = arrayMove(list, from, to);
    setList(next);
    start(() => {
      void reorderCategoriesAction(parentId, next.map((c) => c.id));
    });
  }

  return (
    <DndContext id={`cats-${parentId}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {list.map((c) => (
            <Row key={c.id} c={c} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

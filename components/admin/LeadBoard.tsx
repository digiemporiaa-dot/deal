"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarClock, GripVertical, Phone } from "lucide-react";
import { updateLeadStatus } from "@/app/admin/(panel)/leads/actions";
import { useToast } from "@/components/admin/Toast";
import { ScorePill } from "@/components/admin/LeadScoreCard";
import { StatusBadge, Avatar } from "@/components/admin/ui";
import { leadStatusLabel, isClosedStatus } from "@/lib/crm";
import { leadStatusTone } from "@/lib/admin-status";
import { cn, formatDate } from "@/lib/utils";
import type { BoardCard, BoardColumn } from "@/lib/services/lead-workspace";

/**
 * The pipeline as a board.
 *
 * Dragging a card moves the lead, which is the whole point — a status change
 * that takes one gesture instead of opening a record, finding a dropdown and
 * waiting for a page. The move is applied optimistically and rolled back if
 * the server refuses, so the board never shows a column the database does not
 * agree with.
 *
 * Two drops are deliberately not allowed by dragging:
 *   Won  — creates or links a customer, so it goes through the lead's own
 *          page where the person can see what it matched.
 *   Lost — needs a reason, and a drag has nowhere to type one.
 * Both are still one click away on the card.
 */
export function LeadBoard({
  columns: initial,
  canEdit,
}: {
  columns: BoardColumn[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [columns, setColumns] = React.useState(initial);
  const [dragging, setDragging] = React.useState<BoardCard | null>(null);

  React.useEffect(() => setColumns(initial), [initial]);

  const sensors = useSensors(
    // A short distance threshold means a click opens the lead and only a
    // deliberate drag moves it, so the two gestures never fight.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(event: DragStartEvent) {
    const card = event.active.data.current?.card as BoardCard | undefined;
    setDragging(card ?? null);
  }

  async function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    const card = event.active.data.current?.card as BoardCard | undefined;
    const target = event.over?.id ? String(event.over.id) : null;
    if (!card || !target || target === card.status) return;

    if (isClosedStatus(target)) {
      toast.error(
        target === "CONVERTED"
          ? "Open the lead to convert it — you should see which customer it matches."
          : "Open the lead to close it, so you can record why.",
      );
      return;
    }

    const previous = columns;

    // Optimistic: the card moves under the cursor immediately, because a
    // board that waits for a round trip feels broken.
    setColumns((current) =>
      current.map((column) => {
        if (column.status === card.status) {
          return {
            ...column,
            total: Math.max(0, column.total - 1),
            cards: column.cards.filter((c) => c.id !== card.id),
          };
        }
        if (column.status === target) {
          return {
            ...column,
            total: column.total + 1,
            cards: [{ ...card, status: target }, ...column.cards],
          };
        }
        return column;
      }),
    );

    try {
      const result = await updateLeadStatus(card.id, target);
      if (result.ok) {
        toast.success(`${card.name} moved to ${leadStatusLabel(target)}.`);
        router.refresh();
      } else {
        setColumns(previous);
        toast.error(result.error);
      }
    } catch {
      setColumns(previous);
      toast.error("Could not move that lead. Please try again.");
    }
  }

  const board = (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map((column) => (
        <Column key={column.status} column={column} canEdit={canEdit} />
      ))}
    </div>
  );

  if (!canEdit) return board;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      {board}
      <DragOverlay dropAnimation={null}>
        {dragging ? <Card card={dragging} canEdit={false} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ column, canEdit }: { column: BoardColumn; canEdit: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status, disabled: !canEdit });
  const hidden = column.total - column.cards.length;

  return (
    <section
      ref={setNodeRef}
      aria-label={leadStatusLabel(column.status)}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-card border bg-admin-bg transition-colors",
        isOver ? "border-brand-400 bg-brand-50/60" : "border-admin",
      )}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-card border-b border-admin bg-admin-bg px-3 py-2.5">
        <StatusBadge tone={leadStatusTone(column.status)} dot className="px-0 ring-0">
          {leadStatusLabel(column.status)}
        </StatusBadge>
        <span className="rounded bg-admin-muted px-1.5 text-[11px] font-medium tabular-nums text-admin-text-muted">
          {column.total}
        </span>
      </header>

      <div className="flex-1 space-y-2 p-2">
        {column.cards.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-admin-text-subtle">
            {canEdit ? "Drop a lead here" : "Nothing here"}
          </p>
        ) : (
          column.cards.map((card) => <Card key={card.id} card={card} canEdit={canEdit} />)
        )}

        {hidden > 0 && (
          <Link
            href={`/admin/leads?status=${column.status}`}
            className="block rounded-control border border-dashed border-admin-border-strong px-2 py-2 text-center text-xs font-medium text-admin-text-muted hover:border-brand-400 hover:text-brand-700"
          >
            {hidden} more — open as a list
          </Link>
        )}
      </div>
    </section>
  );
}

function Card({ card, canEdit, overlay }: { card: BoardCard; canEdit: boolean; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled: !canEdit,
  });

  return (
    <article
      ref={setNodeRef}
      className={cn(
        "group/card rounded-control border border-admin bg-admin-card p-2.5 shadow-sm transition-shadow",
        card.overdue && "border-l-2 border-l-red-400",
        isDragging && "opacity-40",
        overlay && "rotate-1 shadow-lg ring-1 ring-brand-300",
      )}
    >
      <div className="flex items-start gap-1.5">
        {canEdit && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move ${card.name}`}
            className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-admin-text-subtle opacity-0 transition-opacity hover:bg-admin-muted focus-visible:opacity-100 group-hover/card:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/admin/leads/${card.id}`}
              className="truncate text-sm font-medium text-admin-text hover:text-brand-700"
            >
              {card.name}
            </Link>
            <ScorePill score={card.score} band={card.scoreBand} />
          </div>

          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-admin-text-muted">
            <Phone className="h-3 w-3 shrink-0" />
            {card.phone}
          </p>

          {(card.destination || card.budget) && (
            <p className="mt-1 truncate text-xs text-admin-text-muted">
              {[card.destination, card.budget].filter(Boolean).join(" · ")}
            </p>
          )}

          {card.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {card.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-admin-muted px-1.5 py-0.5 text-[10px] font-medium text-admin-text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            {card.nextFollowUpAt ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px]",
                  card.overdue ? "font-semibold text-red-600" : "text-admin-text-muted",
                )}
              >
                <CalendarClock className="h-3 w-3" />
                {formatDate(new Date(card.nextFollowUpAt))}
              </span>
            ) : (
              <span className="text-[11px] text-admin-text-subtle">No next step</span>
            )}

            {card.assignedToName ? (
              <Avatar name={card.assignedToName} size="xs" />
            ) : (
              <span className="text-[11px] text-admin-text-subtle">Unassigned</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

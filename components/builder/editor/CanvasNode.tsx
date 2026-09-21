"use client";

import * as React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  CornerLeftUp,
  GripVertical,
  Plus,
  Save,
  Trash2,
  EyeOff,
} from "lucide-react";
import { canNest, getElementDef } from "@/lib/builder/registry";
import { resolveStyle, toCssProperties, isHiddenAt } from "@/lib/builder/styles";
import { str } from "@/lib/builder/content";
import type { BuilderNode, Breakpoint } from "@/lib/builder/schema";
import type { BuilderAction } from "@/components/builder/editor/useBuilderState";
import { ElementPreview } from "@/components/builder/editor/ElementPreview";
import { getElementIcon } from "@/components/builder/editor/element-icons";

/**
 * A node as it appears on the editor canvas: the element's own preview plus
 * the chrome for selecting, dragging, reordering and deleting it.
 *
 * The preview is rendered by `ElementPreview`, which shares its presentational
 * components with the public renderer — so what an admin arranges here is what
 * the published page shows, rather than a separate approximation.
 */

export type CanvasContext = {
  selectedId: string | null;
  /**
   * The innermost node under the pointer.
   *
   * Tracked in state rather than with `group-hover`, because nodes nest:
   * a named Tailwind group matches *any* ancestor carrying that name, so
   * pointing at a heading lit up the toolbars of its column, its container
   * and its section as well — five bars stacked over the content they were
   * meant to label. Each node claims the hover and stops the event, so only
   * the deepest one is ever marked.
   */
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  breakpoint: Breakpoint;
  dispatch: React.Dispatch<BuilderAction>;
  /** Node currently being dragged, so drop zones can check nesting rules. */
  draggingType: string | null;
  onAddInside: (parentId: string, index: number) => void;
  onSaveAsTemplate: (node: BuilderNode) => void;
  isFirst?: boolean;
  isLast?: boolean;
};

/**
 * An insertion point between two children.
 *
 * Explicit gaps rather than sortable reordering: they make the drop position
 * unambiguous, and they are the natural place to refuse a drop that would
 * break the nesting rules.
 */
export function DropZone({
  parentId,
  index,
  ctx,
  orientation = "horizontal",
}: {
  parentId: string | null;
  index: number;
  ctx: CanvasContext;
  orientation?: "horizontal" | "vertical";
}) {
  const id = `drop:${parentId ?? "root"}:${index}`;
  const { setNodeRef, isOver, active } = useDroppable({ id, data: { parentId, index } });

  // A drop zone only lights up for something it can legally accept.
  const dragging = ctx.draggingType;
  const allowed =
    !dragging ||
    (parentId === null ? dragging === "section" : canNest(parentTypeOf(parentId, ctx), dragging));

  const activeDrag = Boolean(active);
  const highlight = isOver && allowed;

  return (
    <div
      ref={setNodeRef}
      data-dropzone
      className={[
        "relative transition-all",
        orientation === "horizontal" ? "w-full" : "h-full",
        activeDrag ? (orientation === "horizontal" ? "my-1 min-h-4" : "mx-1 min-w-4") : "min-h-1",
        highlight ? "bg-brand-500/15" : "",
      ].join(" ")}
      aria-hidden={!activeDrag}
    >
      {highlight && (
        <span
          className={
            orientation === "horizontal"
              ? "absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand-600"
              : "absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-brand-600"
          }
        />
      )}
      {activeDrag && !allowed && isOver && (
        <span className="absolute inset-0 grid place-items-center text-[10px] font-medium text-red-600">
          Cannot drop here
        </span>
      )}
    </div>
  );
}

/**
 * The parent's element type, needed by a drop zone to apply nesting rules.
 * Stored on the DOM node by CanvasNode so the zone does not need the tree.
 */
function parentTypeOf(parentId: string, _ctx: CanvasContext): string {
  if (typeof document === "undefined") return "container";
  const element = document.querySelector(`[data-node-id="${parentId}"]`);
  return element?.getAttribute("data-node-type") ?? "container";
}

export function CanvasNode({
  node,
  ctx,
  parentId = null,
}: {
  node: BuilderNode;
  ctx: CanvasContext;
  /** Set by the parent that rendered this node, for "select parent". */
  parentId?: string | null;
}) {
  const def = getElementDef(node.type);
  const selected = ctx.selectedId === node.id;
  const isSection = node.type === "section";
  const isLayout = def?.category === "layout";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `node:${node.id}`,
    data: { nodeId: node.id, nodeType: node.type },
  });

  const children = node.children ?? [];

  /**
   * The node's own box, styled from its settings.
   *
   * For a `columns` node the grid lives here, on the node's own element —
   * exactly where the published renderer puts it. It used to be applied twice:
   * once here from the settings, and again on a wrapper div inside. That inner
   * grid then occupied a single track of the outer one and split it again, so
   * two columns in an 844px row came out 199px wide with 440px of dead space
   * beside them, and a nested pair shrank to 38px with their labels overlapping.
   */
  const style = toCssProperties(resolveStyle(node.settings, ctx.breakpoint));
  if (node.type === "columns") {
    style.display = style.display ?? "grid";
    // A columns node saved without an explicit count still needs tracks, or
    // its children stack into one implicit column.
    if (!style.gridTemplateColumns) {
      style.gridTemplateColumns = `repeat(${children.length || 1}, minmax(0, 1fr))`;
    }
  }
  const hiddenHere = isHiddenAt(node.settings, ctx.breakpoint);

  const select = (event: React.MouseEvent) => {
    event.stopPropagation();
    ctx.dispatch({ type: "select", id: node.id });
  };

  const acceptsChildren = (def?.allowedChildren.length ?? 0) > 0;
  // Columns lay their children out side by side, so their drop zones are too.
  const childOrientation = node.type === "columns" ? "vertical" : "horizontal";

  const Icon = getElementIcon(node.type);
  const hovered = ctx.hoveredId === node.id;
  /**
   * Exactly one toolbar exists on the canvas at any moment.
   *
   * The pointer wins while it is over the canvas; the selection only shows
   * its toolbar once the pointer has left. Letting both show at once puts two
   * bars on screen, and in a tight stack the lower one covers the element
   * above it — the selected button's toolbar sitting over the paragraph. The
   * selection is still obvious without its toolbar: it keeps the solid
   * outline, and the settings panel is showing it.
   */
  const showChrome = ctx.draggingType
    ? false
    : hovered || (selected && ctx.hoveredId === null);

  return (
    <div
      ref={setNodeRef}
      data-node-id={node.id}
      data-node-type={node.type}
      onClick={select}
      onMouseOver={(event) => {
        // Stopping here is what makes the innermost node win: the ancestors
        // never see the event, so they never mark themselves hovered.
        event.stopPropagation();
        ctx.onHover(node.id);
      }}
      className={[
        "relative",
        selected
          ? "outline outline-2 outline-brand-600"
          : hovered
            ? "outline outline-1 outline-dashed outline-brand-400"
            : "outline outline-1 outline-transparent",
        isDragging ? "opacity-40" : "",
        hiddenHere ? "opacity-40" : "",
      ].join(" ")}
      style={style}
    >
      {/*
        The toolbar sits *above* the element rather than inside it. At
        `-top-px` it covered the element's own first line — a heading's text
        was behind its own label. Sitting clear of the box means it never
        hides what it is labelling, and `whitespace-nowrap` lets it run
        wider than a narrow element instead of wrapping into it.
      */}
      <div
        className={[
          "absolute -top-[22px] left-0 z-30 flex items-center gap-0.5 whitespace-nowrap rounded-t-md px-1 py-[3px] text-[10px] font-semibold text-white shadow-sm",
          selected ? "bg-brand-600" : "bg-brand-500",
          showChrome ? "flex" : "hidden",
        ].join(" ")}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Drag to move"
          className="cursor-grab rounded p-0.5 hover:bg-white/20 active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <Icon className="h-3 w-3 opacity-90" />
        <span className="pr-1">{def?.label ?? node.type}</span>

        {parentId && (
          <IconAction
            title="Select parent"
            onClick={() => ctx.dispatch({ type: "select", id: parentId })}
          >
            <CornerLeftUp className="h-3 w-3" />
          </IconAction>
        )}

        {isSection && (
          <>
            <IconAction
              title="Move up"
              disabled={ctx.isFirst}
              onClick={() => ctx.dispatch({ type: "moveSection", id: node.id, direction: -1 })}
            >
              <ArrowUp className="h-3 w-3" />
            </IconAction>
            <IconAction
              title="Move down"
              disabled={ctx.isLast}
              onClick={() => ctx.dispatch({ type: "moveSection", id: node.id, direction: 1 })}
            >
              <ArrowDown className="h-3 w-3" />
            </IconAction>
            <IconAction title="Save as template" onClick={() => ctx.onSaveAsTemplate(node)}>
              <Save className="h-3 w-3" />
            </IconAction>
          </>
        )}

        <IconAction title="Duplicate" onClick={() => ctx.dispatch({ type: "duplicate", id: node.id })}>
          <Copy className="h-3 w-3" />
        </IconAction>
        <IconAction
          title={hiddenHere ? "Show on this device" : "Hide on this device"}
          onClick={() =>
            ctx.dispatch({
              type: "update",
              id: node.id,
              settings: { hidden: { [ctx.breakpoint]: !hiddenHere } },
            })
          }
        >
          <EyeOff className="h-3 w-3" />
        </IconAction>
        <IconAction title="Delete" onClick={() => ctx.dispatch({ type: "remove", id: node.id })}>
          <Trash2 className="h-3 w-3" />
        </IconAction>
      </div>

      {hiddenHere && (
        <span className="absolute right-1 top-1 z-20 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
          Hidden on {ctx.breakpoint}
        </span>
      )}

      {/* Body: layout nodes host children, everything else renders a preview. */}
      {acceptsChildren ? (
        <div
          // `display: contents` dissolves this wrapper so the column boxes
          // below become items of the node's own grid rather than of a second
          // one nested inside it.
          className={node.type === "columns" ? undefined : "min-h-12"}
          style={node.type === "columns" ? { display: "contents" } : undefined}
        >
          {children.length === 0 ? (
            <EmptyDropTarget node={node} ctx={ctx} />
          ) : node.type === "columns" ? (
            children.map((child) => (
              <div key={child.id} className="min-h-16 rounded border border-dashed border-slate-200">
                <CanvasNode node={child} ctx={ctx} parentId={node.id} />
              </div>
            ))
          ) : (
            <>
              <DropZone parentId={node.id} index={0} ctx={ctx} orientation={childOrientation} />
              {children.map((child, index) => (
                <React.Fragment key={child.id}>
                  <CanvasNode node={child} ctx={ctx} parentId={node.id} />
                  <DropZone
                    parentId={node.id}
                    index={index + 1}
                    ctx={ctx}
                    orientation={childOrientation}
                  />
                </React.Fragment>
              ))}
            </>
          )}

          {isLayout && showChrome && (
            <button
              type="button"
              style={node.type === "columns" ? { gridColumn: "1 / -1" } : undefined}
              onClick={(event) => {
                event.stopPropagation();
                ctx.onAddInside(node.id, children.length);
              }}
              className={[
                "mt-1 flex w-full items-center justify-center gap-1 whitespace-nowrap rounded border border-dashed border-brand-300 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:border-brand-500 hover:bg-brand-50",
              ].join(" ")}
            >
              <Plus className="h-3 w-3" /> Add element
            </button>
          )}
        </div>
      ) : (
        <div className="pointer-events-none">
          <ElementPreview node={node} breakpoint={ctx.breakpoint} />
        </div>
      )}
    </div>
  );
}

function EmptyDropTarget({ node, ctx }: { node: BuilderNode; ctx: CanvasContext }) {
  return (
    <div className="p-2" style={node.type === "columns" ? { gridColumn: "1 / -1" } : undefined}>
      <DropZone parentId={node.id} index={0} ctx={ctx} />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          ctx.onAddInside(node.id, 0);
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-6 text-sm font-medium text-slate-400 hover:border-brand-400 hover:text-brand-600"
      >
        <Plus className="h-4 w-4" /> Add an element here
      </button>
    </div>
  );
}

function IconAction({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="rounded p-0.5 hover:bg-white/20 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export { str };

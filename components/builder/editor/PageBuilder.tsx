"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ArrowLeft,
  Check,
  CloudOff,
  Eye,
  History,
  LayoutTemplate,
  Loader2,
  Monitor,
  Plus,
  Redo2,
  Save,
  Settings2,
  Smartphone,
  Tablet,
  Undo2,
  Upload,
  Recycle,
} from "lucide-react";
import { useToast } from "@/components/admin/Toast";
import { getElementDef } from "@/lib/builder/registry";
import { validateDocument, type BuilderNode, type PageDocument } from "@/lib/builder/schema";
import { createNode, createSectionWith, findNode, regenerateIds } from "@/lib/builder/tree";
import {
  builderReducer,
  initialBuilderState,
  useAutosave,
  useBuilderShortcuts,
} from "@/components/builder/editor/useBuilderState";
import { CanvasNode, DropZone, type CanvasContext } from "@/components/builder/editor/CanvasNode";
import { SettingsPanel } from "@/components/builder/editor/SettingsPanel";
import { PageSettingsDialog } from "@/components/builder/editor/PageSettingsDialog";
import {
  ElementLibrary,
  type LibrarySection,
  type LibraryTemplate,
} from "@/components/builder/editor/ElementLibrary";
import {
  publishPage,
  saveDraft,
  saveReusableSection,
  saveTemplate,
  unpublishPage,
} from "@/app/admin/(panel)/pages/builder-actions";

/**
 * The page builder.
 *
 * Three panels: the element library, the canvas, and the settings for whatever
 * is selected. State lives in a reducer with an undo stack; changes reach the
 * server through a debounced autosave, and only ever reach *visitors* when
 * someone presses Publish.
 *
 * This component and everything it imports load on /admin/pages/[id]/builder
 * only — public pages render through `RenderDocument` and ship none of it.
 */

export type BuilderPage = {
  id: string;
  title: string;
  slug: string;
  status: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  draft: PageDocument;
  hasPublished: boolean;
};

export function PageBuilder({
  page,
  templates,
  sections,
  canPublish,
  canUseRestricted,
}: {
  page: BuilderPage;
  templates: LibraryTemplate[];
  sections: LibrarySection[];
  canPublish: boolean;
  canUseRestricted: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [state, dispatch] = React.useReducer(builderReducer, page.draft, initialBuilderState);
  const [dragging, setDragging] = React.useState<{ label: string; type: string } | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [addingTo, setAddingTo] = React.useState<{ parentId: string; index: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  // Held locally so the toolbar and the preview link update as soon as the
  // details are saved, without reloading the whole builder.
  const [details, setDetails] = React.useState({ title: page.title, slug: page.slug });

  const { document, selectedId, breakpoint, dirty, past, future } = state;

  const onSave = React.useCallback(
    async (doc: PageDocument) => {
      // Validate before the round trip so a broken document is caught with a
      // message rather than a failed request.
      const validated = validateDocument(doc);
      if (!validated.ok) return { ok: false, error: validated.error };
      const result = await saveDraft(page.id, doc);
      if (result.ok) dispatch({ type: "saved" });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    },
    [page.id],
  );

  const { status, saveNow } = useAutosave({ document, dirty, enabled: true, onSave });

  useBuilderShortcuts({ dispatch, selectedId, onSave: () => void saveNow() });

  const sensors = useSensors(
    // A small distance threshold means a click selects and only a deliberate
    // drag moves, so the two never fight each other.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const selectedNode = selectedId ? (findNode(document, selectedId)?.node ?? null) : null;

  /* ── adding ── */

  const addElement = (type: string) => {
    const def = getElementDef(type);
    if (!def) return;

    // A section always goes at the top level; anything else goes into the
    // place the admin last pointed at, or into a new section of its own.
    if (type === "section") {
      dispatch({ type: "insert", node: createNode("section"), target: { parentId: null } });
      return;
    }

    if (addingTo) {
      dispatch({
        type: "insert",
        node: createNode(type),
        target: { parentId: addingTo.parentId, index: addingTo.index },
      });
      setAddingTo(null);
      return;
    }

    // Nothing targeted: wrap the element in a fresh section so it lands
    // somewhere valid rather than being silently dropped.
    dispatch({ type: "insert", node: createSectionWith(type), target: { parentId: null } });
  };

  const addTemplate = (template: LibraryTemplate) => {
    const validated = validateDocument(template.content);
    if (!validated.ok) {
      toast.error("That template could not be read.");
      return;
    }
    for (const section of validated.document.sections) {
      dispatch({ type: "insert", node: regenerateIds(section), target: { parentId: null }, select: false });
    }
    toast.success(`Added "${template.name}".`);
  };

  const addReusable = (section: LibrarySection) => {
    // The page stores only a reference; the renderer resolves it at request
    // time, which is what makes one edit update every page.
    const node: BuilderNode = {
      id: `reuse-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      type: "section",
      reusableId: section.id,
      content: {},
      settings: {},
    };
    dispatch({ type: "insert", node, target: { parentId: null } });
    toast.success(`Added "${section.name}".`);
  };

  /* ── drag and drop ── */

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.newType) {
      setDragging({ type: data.newType as string, label: getElementDef(data.newType as string)?.label ?? "" });
    } else if (data?.nodeType) {
      setDragging({
        type: data.nodeType as string,
        label: getElementDef(data.nodeType as string)?.label ?? "",
      });
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const over = event.over;
    if (!over) return;

    const target = over.data.current as { parentId: string | null; index: number } | undefined;
    if (!target) return;

    const active = event.active.data.current;

    if (active?.newType) {
      const type = active.newType as string;
      // Dropping a non-section at the top level wraps it in a section, so the
      // drop always produces a valid tree.
      const node =
        target.parentId === null && type !== "section" ? createSectionWith(type) : createNode(type);
      dispatch({ type: "insert", node, target });
      return;
    }

    if (active?.nodeId) {
      dispatch({ type: "move", id: active.nodeId as string, target });
    }
  };

  /* ── publishing ── */

  const publish = async () => {
    setPublishing(true);
    try {
      // Always save first, so what goes live is exactly what is on screen.
      const saved = await saveNow();
      if (!saved && dirty) {
        toast.error("Could not save the draft, so nothing was published.");
        return;
      }
      const result = await publishPage(page.id, document);
      if (result.ok) {
        toast.success("Page published.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async () => {
    const result = await unpublishPage(page.id);
    if (result.ok) {
      toast.success("Page unpublished.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const saveAsTemplate = async (node: BuilderNode) => {
    const name = window.prompt("Template name");
    if (!name) return;
    const result = await saveTemplate({ name, kind: "section" }, node);
    if (result.ok) {
      toast.success("Saved to the template library.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  /** Save the whole page as a starting point for new pages. */
  const saveAsPageTemplate = async () => {
    const name = window.prompt("Name for this page template");
    if (!name) return;
    const result = await saveTemplate({ name, kind: "page", category: "Pages" }, document);
    if (result.ok) {
      toast.success("Saved. It is now offered when creating a page.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const saveAsReusable = async () => {
    if (!selectedNode || selectedNode.type !== "section") {
      toast.error("Select a section first.");
      return;
    }
    const name = window.prompt("Name for this reusable section");
    if (!name) return;
    const result = await saveReusableSection({ name }, selectedNode);
    if (result.ok) {
      toast.success("Saved. It is now available on every page.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const ctx: CanvasContext = {
    selectedId,
    breakpoint,
    dispatch,
    draggingType: dragging?.type ?? null,
    onAddInside: (parentId, index) => {
      setAddingTo({ parentId, index });
      toast.push("Now pick an element from the left panel.");
    },
    onSaveAsTemplate: saveAsTemplate,
  };

  const canvasWidth =
    breakpoint === "mobile" ? "390px" : breakpoint === "tablet" ? "820px" : "100%";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="fixed inset-0 z-40 flex flex-col bg-slate-100">
        {/* Toolbar */}
        <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <a
            href="/admin/pages"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" /> Pages
          </a>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Page settings and SEO"
            className="group flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left hover:bg-slate-100"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{details.title}</span>
              <span className="block truncate text-[11px] text-slate-400">/{details.slug}</span>
            </span>
            <Settings2 className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" />
          </button>

          <div className="mx-2 flex items-center gap-0.5">
            <ToolbarButton
              title="Undo (Ctrl+Z)"
              disabled={past.length === 0}
              onClick={() => dispatch({ type: "undo" })}
            >
              <Undo2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Redo (Ctrl+Shift+Z)"
              disabled={future.length === 0}
              onClick={() => dispatch({ type: "redo" })}
            >
              <Redo2 className="h-4 w-4" />
            </ToolbarButton>
          </div>

          {/* Device switcher */}
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {(
              [
                ["desktop", Monitor],
                ["tablet", Tablet],
                ["mobile", Smartphone],
              ] as const
            ).map(([device, Icon]) => (
              <button
                key={device}
                type="button"
                title={`Preview ${device}`}
                onClick={() => dispatch({ type: "breakpoint", breakpoint: device })}
                className={`rounded-md p-1.5 ${
                  breakpoint === device ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <SaveIndicator status={status} dirty={dirty} />

          <div className="ml-auto flex items-center gap-2">
            <ToolbarButton title="Save a reusable section from the selected section" onClick={saveAsReusable}>
              <Recycle className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton title="Save this page as a template" onClick={saveAsPageTemplate}>
              <LayoutTemplate className="h-4 w-4" />
            </ToolbarButton>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Page settings and SEO"
              className="inline-flex h-9 items-center rounded-lg px-2.5 text-slate-600 hover:bg-slate-100"
            >
              <Settings2 className="h-4 w-4" />
            </button>

            <a
              href={`/admin/pages/${page.id}/revisions`}
              title="Revision history"
              className="inline-flex h-9 items-center rounded-lg px-2.5 text-slate-600 hover:bg-slate-100"
            >
              <History className="h-4 w-4" />
            </a>

            <a
              href={`/${details.slug}?preview=1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" /> Preview
            </a>

            <button
              type="button"
              onClick={() => void saveNow()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Save className="h-4 w-4" /> Save draft
            </button>

            {canPublish &&
              (page.status === "PUBLISHED" ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={publish}
                    disabled={publishing}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={unpublish}
                    className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Unpublish
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={publish}
                  disabled={publishing}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Publish
                </button>
              ))}
          </div>
        </header>

        {/* Panels */}
        <div className="flex min-h-0 flex-1">
          <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
            <ElementLibrary
              templates={templates}
              sections={sections}
              onAdd={addElement}
              onAddTemplate={addTemplate}
              onAddReusable={addReusable}
            />
          </aside>

          <main
            className="flex-1 overflow-y-auto bg-slate-200/60 p-6"
            onClick={() => dispatch({ type: "select", id: null })}
          >
            <div
              className="mx-auto min-h-full bg-white shadow-sm transition-all"
              style={{ width: canvasWidth, maxWidth: "100%" }}
            >
              {document.sections.length === 0 ? (
                <EmptyState onAddSection={() => addElement("section")} />
              ) : (
                <>
                  <DropZone parentId={null} index={0} ctx={ctx} />
                  {document.sections.map((section, index) => (
                    <React.Fragment key={section.id}>
                      <CanvasNode
                        node={section}
                        ctx={{
                          ...ctx,
                          isFirst: index === 0,
                          isLast: index === document.sections.length - 1,
                        }}
                      />
                      <DropZone parentId={null} index={index + 1} ctx={ctx} />
                    </React.Fragment>
                  ))}
                </>
              )}
            </div>
          </main>

          <aside className="w-80 shrink-0 overflow-hidden border-l border-slate-200 bg-white">
            <SettingsPanel
              node={selectedNode}
              breakpoint={breakpoint}
              dispatch={dispatch}
              canUseRestricted={canUseRestricted}
            />
          </aside>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-lg">
            {dragging.label}
          </div>
        )}
      </DragOverlay>

      {settingsOpen && (
        <PageSettingsDialog
          page={{
            id: page.id,
            title: details.title,
            slug: details.slug,
            seoTitle: page.seoTitle,
            seoDescription: page.seoDescription,
            ogImage: page.ogImage,
          }}
          onClose={() => setSettingsOpen(false)}
          onSaved={setDetails}
        />
      )}
    </DndContext>
  );
}

function ToolbarButton({
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
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center rounded-lg px-2.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SaveIndicator({
  status,
  dirty,
}: {
  status: { state: string; at?: number; message?: string };
  dirty: boolean;
}) {
  const [, tick] = React.useReducer((value: number) => value + 1, 0);

  // Re-render every 20s so "saved 2 minutes ago" stays honest.
  React.useEffect(() => {
    const timer = setInterval(tick, 20_000);
    return () => clearInterval(timer);
  }, []);

  if (status.state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  if (status.state === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
        <CloudOff className="h-3.5 w-3.5" /> {status.message || "Not saved"}
      </span>
    );
  }
  if (dirty) {
    return <span className="text-xs text-amber-600">Unsaved changes</span>;
  }
  if (status.state === "saved" && status.at) {
    const seconds = Math.round((Date.now() - status.at) / 1000);
    const label =
      seconds < 10 ? "just now" : seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`;
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600">
        <Check className="h-3.5 w-3.5" /> Saved {label}
      </span>
    );
  }
  return null;
}

function EmptyState({ onAddSection }: { onAddSection: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center p-10 text-center">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Start building your page</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
          Add a section, then drag elements into it from the left. Or start from a template.
        </p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAddSection();
          }}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Add a section
        </button>
      </div>
    </div>
  );
}

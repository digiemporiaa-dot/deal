"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { Blocks, LayoutTemplate, Recycle, Search } from "lucide-react";
import {
  CATEGORY_LABELS,
  elementsByCategory,
  type ElementCategory,
  type ElementDef,
} from "@/lib/builder/registry";
import { getElementIcon } from "@/components/builder/editor/element-icons";

/**
 * The left panel: every element that can be added, plus saved templates and
 * reusable sections.
 *
 * Each entry is both draggable onto the canvas and clickable — clicking adds
 * it to the current selection, which keeps the builder usable with a keyboard
 * and on a tablet where dragging is fiddly.
 */

export type LibraryTemplate = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  category: string;
  content: unknown;
};

export type LibrarySection = { id: string; name: string; description: string | null };

type Panel = "elements" | "templates" | "sections";

function DraggableElement({
  def,
  onAdd,
}: {
  def: ElementDef;
  onAdd: (type: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new:${def.type}`,
    data: { newType: def.type },
  });
  const Icon = getElementIcon(def.icon);

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={() => onAdd(def.type)}
      title={def.description ? `${def.label} — ${def.description}` : def.label}
      className={`flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-3 text-center transition-colors hover:border-brand-400 hover:bg-brand-50 active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <Icon className="h-4 w-4 text-brand-600" />
      <span className="text-[11px] font-medium leading-tight text-slate-700">{def.label}</span>
    </button>
  );
}

export function ElementLibrary({
  templates,
  sections,
  onAdd,
  onAddTemplate,
  onAddReusable,
}: {
  templates: LibraryTemplate[];
  sections: LibrarySection[];
  onAdd: (type: string) => void;
  onAddTemplate: (template: LibraryTemplate) => void;
  onAddReusable: (section: LibrarySection) => void;
}) {
  const [panel, setPanel] = React.useState<Panel>("elements");
  const [query, setQuery] = React.useState("");

  const grouped = React.useMemo(() => elementsByCategory(), []);
  const search = query.trim().toLowerCase();

  const sectionTemplates = templates.filter((template) => template.kind === "section");

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-slate-200">
        {(
          [
            ["elements", "Elements", Blocks],
            ["templates", "Templates", LayoutTemplate],
            ["sections", "Saved", Recycle],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPanel(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-medium ${
              panel === key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {panel === "elements" && (
        <>
          <div className="relative border-b border-slate-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search elements"
              className="h-8 w-full rounded border border-slate-300 pl-8 pr-2 text-xs focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {(Object.keys(grouped) as ElementCategory[]).map((category) => {
              const items = grouped[category].filter(
                (def) =>
                  !search ||
                  def.label.toLowerCase().includes(search) ||
                  def.type.toLowerCase().includes(search),
              );
              if (items.length === 0) return null;

              return (
                <div key={category} className="mb-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {CATEGORY_LABELS[category]}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {items.map((def) => (
                      <DraggableElement key={def.type} def={def} onAdd={onAdd} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {panel === "templates" && (
        <div className="flex-1 overflow-y-auto p-2">
          {sectionTemplates.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400">
              No section templates yet. Build a section you like, then use its{" "}
              <strong>Save as template</strong> control.
            </p>
          ) : (
            Object.entries(
              sectionTemplates.reduce<Record<string, LibraryTemplate[]>>((groups, template) => {
                (groups[template.category] ??= []).push(template);
                return groups;
              }, {}),
            ).map(([category, items]) => (
              <div key={category} className="mb-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {category}
                </p>
                <div className="space-y-1.5">
                  {items.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onAddTemplate(template)}
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:border-brand-400 hover:bg-brand-50"
                    >
                      <LayoutTemplate className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {panel === "sections" && (
        <div className="flex-1 overflow-y-auto p-2">
          <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-snug text-slate-500">
            A saved section stays linked: edit it once and every page using it updates.
          </p>
          {sections.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400">
              Nothing saved yet. Select a section and choose <strong>Save as reusable</strong>.
            </p>
          ) : (
            <div className="space-y-1.5">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onAddReusable(section)}
                  className="flex w-full flex-col gap-0.5 rounded-lg border border-slate-200 px-3 py-2.5 text-left hover:border-brand-400 hover:bg-brand-50"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <Recycle className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                    {section.name}
                  </span>
                  {section.description && (
                    <span className="text-[11px] text-slate-400">{section.description}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

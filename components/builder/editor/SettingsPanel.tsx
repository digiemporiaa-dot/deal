"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Image as ImageIcon,
  Monitor,
  Plus,
  Search,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from "lucide-react";
import { getElementDef, type FieldDef } from "@/lib/builder/registry";
import { BUILDER_ICON_NAMES, getIcon } from "@/components/builder/icons";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { MediaPicker, type PickedMedia } from "@/components/builder/editor/MediaPicker";
import type { BuilderNode, Breakpoint, NodeContent, StyleSettings } from "@/lib/builder/schema";
import type { BuilderAction } from "@/components/builder/editor/useBuilderState";

/**
 * The right-hand settings panel.
 *
 * Content controls are generated from the element's `fields` in the registry,
 * so adding an element never means writing panel code. Style and Advanced are
 * shared by every element and always edit the breakpoint currently selected in
 * the toolbar — which is what makes the responsive controls overrides rather
 * than three separate designs.
 */

const TABS = ["Content", "Style", "Advanced"] as const;
type Tab = (typeof TABS)[number];

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

function Label({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <div className="mb-1.5">
      <span className="block text-xs font-medium text-slate-700">{children}</span>
      {help && <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{help}</span>}
    </div>
  );
}

function Group({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 py-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        {title}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

/* ───────────────────────── field renderers ───────────────────────── */

function ImageField({
  value,
  onChange,
  onPicked,
}: {
  value: string;
  onChange: (value: string) => void;
  onPicked?: (media: PickedMedia) => void;
}) {
  const [picking, setPicking] = React.useState(false);
  return (
    <>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="/uploads/… or https://…"
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setPicking(true)}
          title="Choose from the media library"
          className="inline-flex h-[38px] shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
      </div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary hosts
        <img src={value} alt="" className="mt-2 h-20 w-full rounded-lg border border-slate-200 object-cover" />
      )}
      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        onSelect={(media) => {
          onChange(media.url);
          onPicked?.(media);
        }}
      />
    </>
  );
}

function IconField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const Current = getIcon(value);
  const matches = BUILDER_ICON_NAMES.filter((name) =>
    name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
      >
        <Current className="h-4 w-4 text-brand-600" />
        <span className="flex-1 text-left text-slate-700">{value || "Choose an icon"}</span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear icon"
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.stopPropagation();
                onChange("");
              }
            }}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-slate-200 p-2">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search icons"
              className="h-8 w-full rounded border border-slate-300 pl-8 pr-2 text-xs focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="grid max-h-48 grid-cols-6 gap-1 overflow-y-auto">
            {matches.map((name) => {
              const Icon = getIcon(name);
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                  className={`grid h-8 place-items-center rounded hover:bg-brand-50 ${
                    value === name ? "bg-brand-100 text-brand-700" : "text-slate-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Manual picker for packages, destinations or blog posts. */
function CollectionField({
  resource,
  value,
  onChange,
}: {
  resource: "package" | "destination" | "blog";
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [options, setOptions] = React.useState<{ id: string; label: string; sub?: string }[]>([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(
    async (search: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ resource, q: search });
        const response = await fetch(`/api/admin/builder/search?${params.toString()}`);
        const data = await response.json();
        if (data.ok) setOptions(data.results);
      } finally {
        setLoading(false);
      }
    },
    [resource],
  );

  React.useEffect(() => {
    void load("");
  }, [load]);

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearch = (next: string) => {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(next), 300);
  };

  const byId = new Map(options.map((option) => [option.id, option]));

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 space-y-1">
          {value.map((id, index) => (
            <li key={id} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-xs">
              <GripVertical className="h-3 w-3 shrink-0 text-slate-300" />
              <span className="flex-1 truncate">{byId.get(id)?.label ?? id}</span>
              <button
                type="button"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => {
                  const next = [...value];
                  [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                  onChange(next);
                }}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onChange(value.filter((item) => item !== id))}
                className="text-slate-400 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={`Search ${resource}s`}
          className="h-8 w-full rounded border border-slate-300 pl-8 pr-2 text-xs focus:border-brand-500 focus:outline-none"
        />
      </div>

      <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200">
        {loading ? (
          <p className="p-3 text-center text-xs text-slate-400">Loading…</p>
        ) : options.length === 0 ? (
          <p className="p-3 text-center text-xs text-slate-400">Nothing found</p>
        ) : (
          options
            .filter((option) => !value.includes(option.id))
            .map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange([...value, option.id])}
                className="flex w-full items-center gap-2 border-b border-slate-100 px-2 py-1.5 text-left text-xs last:border-0 hover:bg-brand-50"
              >
                <Plus className="h-3 w-3 shrink-0 text-brand-600" />
                <span className="flex-1 truncate">{option.label}</span>
                {option.sub && <span className="shrink-0 text-slate-400">{option.sub}</span>}
              </button>
            ))
        )}
      </div>
    </div>
  );
}

/** A repeater: a list of items, each with its own sub-fields. */
function RepeaterField({
  field,
  value,
  onChange,
}: {
  field: Extract<FieldDef, { type: "repeater" }>;
  value: Record<string, unknown>[];
  onChange: (items: Record<string, unknown>[]) => void;
}) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);
  const atMax = field.max !== undefined && value.length >= field.max;

  const update = (index: number, key: string, next: unknown) => {
    const items = value.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: next } : item,
    );
    onChange(items);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const items = [...value];
    [items[index], items[target]] = [items[target]!, items[index]!];
    onChange(items);
    setOpenIndex(target);
  };

  return (
    <div className="space-y-2">
      {value.map((item, index) => {
        const open = openIndex === index;
        const label =
          (typeof item.title === "string" && item.title) ||
          (typeof item.question === "string" && item.question) ||
          (typeof item.name === "string" && item.name) ||
          (typeof item.text === "string" && item.text) ||
          `${field.itemLabel} ${index + 1}`;

        return (
          <div key={index} className="rounded-lg border border-slate-200">
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex-1 truncate text-left text-xs font-medium text-slate-700"
              >
                {String(label).slice(0, 40)}
              </button>
              <button
                type="button"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${field.itemLabel}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {open && (
              <div className="space-y-2.5 border-t border-slate-100 p-2.5">
                {field.fields.map((sub) => (
                  <div key={sub.key}>
                    <Label help={sub.help}>{sub.label}</Label>
                    <PrimitiveField
                      field={sub}
                      value={item[sub.key]}
                      onChange={(next) => update(index, sub.key, next)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        disabled={atMax}
        onClick={() => {
          onChange([...value, {}]);
          setOpenIndex(value.length);
        }}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-40"
      >
        <Plus className="h-3 w-3" /> Add {field.itemLabel.toLowerCase()}
        {atMax && ` (max ${field.max})`}
      </button>
    </div>
  );
}

/** One field of any non-repeater kind. */
function PrimitiveField({
  field,
  value,
  onChange,
  onPickedImage,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
  onPickedImage?: (media: PickedMedia) => void;
}) {
  const text = typeof value === "string" ? value : "";

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          rows={field.rows ?? 3}
          value={text}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      );

    case "richtext":
      return <RichTextEditor value={text} onChange={onChange} />;

    case "number":
      return (
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={typeof value === "number" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? undefined : Number(event.target.value))
          }
          className={inputClass}
        />
      );

    case "color":
      return (
        <div className="flex gap-2">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(text) ? text : "#000000"}
            onChange={(event) => onChange(event.target.value)}
            className="h-[38px] w-12 shrink-0 cursor-pointer rounded border border-slate-300"
          />
          <input
            value={text}
            onChange={(event) => onChange(event.target.value)}
            placeholder="#0d9488 or rgba(…)"
            className={inputClass}
          />
        </div>
      );

    case "image":
      return <ImageField value={text} onChange={onChange} onPicked={onPickedImage} />;

    case "icon":
      return <IconField value={text} onChange={onChange} />;

    case "switch":
      return (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          Enabled
        </label>
      );

    case "select":
      return (
        <select value={text} onChange={(event) => onChange(event.target.value)} className={inputClass}>
          <option value="">Default</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case "collection":
      return (
        <CollectionField
          resource={field.resource}
          value={Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []}
          onChange={onChange}
        />
      );

    case "repeater":
      return (
        <RepeaterField
          field={field}
          value={
            Array.isArray(value)
              ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
              : []
          }
          onChange={onChange}
        />
      );

    default:
      return (
        <input
          value={text}
          placeholder={"placeholder" in field ? field.placeholder : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      );
  }
}

/* ───────────────────────── style controls ───────────────────────── */

const SPACING_SIDES = ["top", "right", "bottom", "left"] as const;

function SpacingControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Record<string, string | undefined> | undefined;
  onChange: (next: Record<string, string | undefined>) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="grid grid-cols-4 gap-1.5">
        {SPACING_SIDES.map((side) => (
          <input
            key={side}
            value={value?.[side] ?? ""}
            placeholder={side[0]!.toUpperCase()}
            title={side}
            onChange={(event) => onChange({ ...(value ?? {}), [side]: event.target.value })}
            className="w-full rounded border border-slate-300 px-1.5 py-1.5 text-center text-xs focus:border-brand-500 focus:outline-none"
          />
        ))}
      </div>
    </div>
  );
}

function StyleTab({
  node,
  breakpoint,
  onChange,
}: {
  node: BuilderNode;
  breakpoint: Breakpoint;
  onChange: (patch: StyleSettings) => void;
}) {
  // Only this breakpoint's own values are shown, so an empty box means
  // "inherits from the device above" rather than "no value".
  const style = node.settings?.[breakpoint] ?? {};
  const set = (key: keyof StyleSettings, value: unknown) => onChange({ [key]: value } as StyleSettings);

  const textInput = (key: keyof StyleSettings, placeholder?: string) => (
    <input
      value={(style[key] as string) ?? ""}
      placeholder={placeholder}
      onChange={(event) => set(key, event.target.value)}
      className={inputClass}
    />
  );

  return (
    <div>
      {breakpoint !== "desktop" && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
          Editing the <strong>{breakpoint}</strong> override. Leave a field empty to inherit from the
          larger device.
        </p>
      )}

      <Group title="Typography">
        <div>
          <Label>Font size</Label>
          {textInput("fontSize", "32px")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Weight</Label>
            <select
              value={style.fontWeight ?? ""}
              onChange={(event) => set("fontWeight", event.target.value)}
              className={inputClass}
            >
              <option value="">Default</option>
              {["300", "400", "500", "600", "700", "800"].map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Line height</Label>
            {textInput("lineHeight", "1.5")}
          </div>
        </div>
        <div>
          <Label>Alignment</Label>
          <select
            value={style.textAlign ?? ""}
            onChange={(event) => set("textAlign", event.target.value)}
            className={inputClass}
          >
            <option value="">Default</option>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
            <option value="justify">Justify</option>
          </select>
        </div>
        <div>
          <Label>Text colour</Label>
          <PrimitiveField
            field={{ key: "color", label: "Colour", type: "color" }}
            value={style.color}
            onChange={(value) => set("color", value)}
          />
        </div>
      </Group>

      <Group title="Background">
        <div>
          <Label>Background colour or gradient</Label>
          <PrimitiveField
            field={{ key: "background", label: "Background", type: "color" }}
            value={style.background}
            onChange={(value) => set("background", value)}
          />
        </div>
        <div>
          <Label>Background image</Label>
          <ImageField
            value={style.backgroundImage ?? ""}
            onChange={(value) => set("backgroundImage", value)}
          />
        </div>
        <div>
          <Label help="Drawn over the image so text stays readable.">Overlay</Label>
          <PrimitiveField
            field={{ key: "overlay", label: "Overlay", type: "color" }}
            value={style.overlay}
            onChange={(value) => set("overlay", value)}
          />
        </div>
      </Group>

      <Group title="Spacing">
        <SpacingControl
          label="Padding"
          value={style.padding}
          onChange={(value) => set("padding", value)}
        />
        <SpacingControl label="Margin" value={style.margin} onChange={(value) => set("margin", value)} />
      </Group>

      <Group title="Layout" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Width</Label>
            {textInput("width", "100%")}
          </div>
          <div>
            <Label>Max width</Label>
            {textInput("maxWidth", "1200px")}
          </div>
        </div>
        <div>
          <Label>Minimum height</Label>
          {textInput("minHeight", "400px")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Display</Label>
            <select
              value={style.display ?? ""}
              onChange={(event) => set("display", event.target.value)}
              className={inputClass}
            >
              <option value="">Default</option>
              <option value="block">Block</option>
              <option value="flex">Flex</option>
              <option value="grid">Grid</option>
            </select>
          </div>
          <div>
            <Label help="Grid columns on this device.">Columns</Label>
            <select
              value={style.columns ? String(style.columns) : ""}
              onChange={(event) =>
                set("columns", event.target.value ? Number(event.target.value) : undefined)
              }
              className={inputClass}
            >
              <option value="">Default</option>
              {[1, 2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Direction</Label>
            <select
              value={style.flexDirection ?? ""}
              onChange={(event) => set("flexDirection", event.target.value)}
              className={inputClass}
            >
              <option value="">Default</option>
              <option value="row">Row</option>
              <option value="column">Column</option>
            </select>
          </div>
          <div>
            <Label>Gap</Label>
            {textInput("gap", "24px")}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Align</Label>
            <select
              value={style.alignItems ?? ""}
              onChange={(event) => set("alignItems", event.target.value)}
              className={inputClass}
            >
              <option value="">Default</option>
              <option value="flex-start">Start</option>
              <option value="center">Center</option>
              <option value="flex-end">End</option>
              <option value="stretch">Stretch</option>
            </select>
          </div>
          <div>
            <Label>Justify</Label>
            <select
              value={style.justifyContent ?? ""}
              onChange={(event) => set("justifyContent", event.target.value)}
              className={inputClass}
            >
              <option value="">Default</option>
              <option value="flex-start">Start</option>
              <option value="center">Center</option>
              <option value="flex-end">End</option>
              <option value="space-between">Space between</option>
            </select>
          </div>
        </div>
      </Group>

      <Group title="Border" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Width</Label>
            {textInput("borderWidth", "1px")}
          </div>
          <div>
            <Label>Radius</Label>
            {textInput("borderRadius", "16px")}
          </div>
        </div>
        <div>
          <Label>Colour</Label>
          <PrimitiveField
            field={{ key: "borderColor", label: "Border colour", type: "color" }}
            value={style.borderColor}
            onChange={(value) => set("borderColor", value)}
          />
        </div>
        <div>
          <Label>Style</Label>
          <select
            value={style.borderStyle ?? ""}
            onChange={(event) => set("borderStyle", event.target.value)}
            className={inputClass}
          >
            <option value="">None</option>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>
        <div>
          <Label>Shadow</Label>
          {textInput("boxShadow", "0 10px 30px rgba(0,0,0,.08)")}
        </div>
      </Group>
    </div>
  );
}

/* ──────────────────────────── the panel ──────────────────────────── */

export function SettingsPanel({
  node,
  breakpoint,
  dispatch,
  canUseRestricted,
}: {
  node: BuilderNode | null;
  breakpoint: Breakpoint;
  dispatch: React.Dispatch<BuilderAction>;
  canUseRestricted: boolean;
}) {
  const [tab, setTab] = React.useState<Tab>("Content");
  const def = node ? getElementDef(node.type) : undefined;

  if (!node || !def) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm font-medium text-slate-700">Nothing selected</p>
        <p className="mt-1 text-xs text-slate-500">
          Click any element on the page to edit its content and styling.
        </p>
      </div>
    );
  }

  const setContent = (key: string, value: unknown) =>
    dispatch({ type: "update", id: node.id, content: { [key]: value } as NodeContent });

  const setStyle = (patch: StyleSettings) =>
    dispatch({ type: "update", id: node.id, settings: { [breakpoint]: patch } });

  const restrictedBlocked = def.restricted && !canUseRestricted;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 pb-0 pt-3">
        <p className="text-sm font-semibold text-slate-900">{def.label}</p>
        {def.description && <p className="mt-0.5 text-[11px] text-slate-500">{def.description}</p>}
        <div className="mt-3 flex gap-1">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium ${
                tab === name
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {tab === "Content" && (
          <div className="space-y-3 pt-3">
            {restrictedBlocked ? (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Custom HTML can only be edited by an administrator.
              </p>
            ) : def.fields.length === 0 ? (
              <p className="pt-2 text-xs text-slate-500">
                This element has no content of its own — use the Style tab, or edit the elements
                inside it.
              </p>
            ) : (
              def.fields.map((field) => (
                <div key={field.key}>
                  <Label help={field.help}>{field.label}</Label>
                  <PrimitiveField
                    field={field}
                    value={node.content?.[field.key]}
                    onChange={(value) => setContent(field.key, value)}
                    onPickedImage={(media) => {
                      // Selecting from the library fills in the alt text the
                      // image was given there, so it is never silently lost.
                      if (media.alt && !node.content?.alt) setContent("alt", media.alt);
                    }}
                  />
                </div>
              ))
            )}

            {node.type === "columns" && (
              <div>
                <Label help="Existing content is kept — removing a column moves its elements into the last one.">
                  Number of columns
                </Label>
                <select
                  value={String(node.children?.length ?? 2)}
                  onChange={(event) =>
                    dispatch({ type: "columns", id: node.id, count: Number(event.target.value) })
                  }
                  className={inputClass}
                >
                  {[1, 2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {tab === "Style" && <StyleTab node={node} breakpoint={breakpoint} onChange={setStyle} />}

        {tab === "Advanced" && (
          <div className="pt-3">
            <Group title="Visibility">
              <p className="text-[11px] text-slate-500">
                A hidden element is not rendered on that device at all — its content never reaches
                the page.
              </p>
              {(
                [
                  ["desktop", Monitor],
                  ["tablet", Tablet],
                  ["mobile", Smartphone],
                ] as const
              ).map(([device, Icon]) => (
                <label key={device} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(node.settings?.hidden?.[device])}
                    onChange={(event) =>
                      dispatch({
                        type: "update",
                        id: node.id,
                        settings: { hidden: { [device]: event.target.checked } },
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  <Icon className="h-4 w-4 text-slate-400" />
                  Hide on {device}
                </label>
              ))}
            </Group>

            <Group title="Attributes">
              <div>
                <Label help="Letters, numbers, spaces, dashes and underscores.">CSS class</Label>
                <input
                  value={node.settings?.advanced?.customClass ?? ""}
                  onChange={(event) =>
                    dispatch({
                      type: "update",
                      id: node.id,
                      settings: { advanced: { customClass: event.target.value } },
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <Label help="Lets a button link to #this-id.">Anchor id</Label>
                <input
                  value={node.settings?.advanced?.customId ?? ""}
                  onChange={(event) =>
                    dispatch({
                      type: "update",
                      id: node.id,
                      settings: { advanced: { customId: event.target.value } },
                    })
                  }
                  className={inputClass}
                />
              </div>
            </Group>
          </div>
        )}
      </div>
    </div>
  );
}

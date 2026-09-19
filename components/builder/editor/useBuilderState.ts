"use client";

import * as React from "react";
import type { BuilderNode, Breakpoint, NodeContent, NodeSettings, PageDocument } from "@/lib/builder/schema";
import {
  createNode,
  duplicateNode,
  findNode,
  insertNode,
  moveNode,
  moveSection,
  regenerateIds,
  removeNode,
  setColumnCount,
  updateNode,
  type InsertTarget,
} from "@/lib/builder/tree";

/**
 * Editor state: the document, the selection, the device being previewed, and
 * the undo history.
 *
 * History is a stack of whole documents rather than inverse operations. The
 * tree operations are already immutable, so each past state costs only the
 * nodes that actually changed — and undo can never drift out of sync with the
 * document the way replayed inverse operations can.
 */

const HISTORY_LIMIT = 60;

export type BuilderState = {
  document: PageDocument;
  selectedId: string | null;
  breakpoint: Breakpoint;
  past: PageDocument[];
  future: PageDocument[];
  /** Set whenever the document differs from what was last saved. */
  dirty: boolean;
  /** Node copied with Ctrl+C, available to paste. */
  clipboard: BuilderNode | null;
};

export type BuilderAction =
  | { type: "select"; id: string | null }
  | { type: "breakpoint"; breakpoint: Breakpoint }
  | { type: "insert"; node: BuilderNode; target: InsertTarget; select?: boolean }
  | { type: "move"; id: string; target: InsertTarget }
  | { type: "moveSection"; id: string; direction: -1 | 1 }
  | { type: "update"; id: string; content?: NodeContent; settings?: NodeSettings }
  | { type: "remove"; id: string }
  | { type: "duplicate"; id: string }
  | { type: "columns"; id: string; count: number }
  | { type: "copy"; id: string }
  | { type: "paste"; target: InsertTarget }
  | { type: "replace"; document: PageDocument; resetHistory?: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "saved" };

/** Wrap a document change so it lands on the undo stack. */
function commit(state: BuilderState, document: PageDocument, selectedId?: string | null): BuilderState {
  if (document === state.document) return state;
  return {
    ...state,
    document,
    past: [...state.past, state.document].slice(-HISTORY_LIMIT),
    future: [],
    dirty: true,
    ...(selectedId !== undefined ? { selectedId } : {}),
  };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };

    case "breakpoint":
      return { ...state, breakpoint: action.breakpoint };

    case "insert": {
      const next = insertNode(state.document, action.node, action.target);
      // insertNode returns the same object when the nesting rule refused it.
      if (next === state.document) return state;
      return commit(state, next, action.select === false ? undefined : action.node.id);
    }

    case "move":
      return commit(state, moveNode(state.document, action.id, action.target));

    case "moveSection":
      return commit(state, moveSection(state.document, action.id, action.direction));

    case "update":
      return commit(
        state,
        updateNode(state.document, action.id, {
          content: action.content,
          settings: action.settings,
        }),
      );

    case "remove": {
      const next = removeNode(state.document, action.id);
      return commit(state, next, state.selectedId === action.id ? null : undefined);
    }

    case "duplicate":
      return commit(state, duplicateNode(state.document, action.id));

    case "columns":
      return commit(state, setColumnCount(state.document, action.id, action.count));

    case "copy": {
      const found = findNode(state.document, action.id);
      return found ? { ...state, clipboard: found.node } : state;
    }

    case "paste": {
      if (!state.clipboard) return state;
      // A pasted node is a copy, so it needs its own ids.
      const copy = regenerateIds(state.clipboard);
      const next = insertNode(state.document, copy, action.target);
      if (next === state.document) return state;
      return commit(state, next, copy.id);
    }

    case "replace":
      return action.resetHistory
        ? { ...state, document: action.document, past: [], future: [], dirty: false, selectedId: null }
        : commit(state, action.document);

    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        document: previous,
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future].slice(0, HISTORY_LIMIT),
        dirty: true,
        // The selected node may not exist in the restored document.
        selectedId: findNode(previous, state.selectedId ?? "") ? state.selectedId : null,
      };
    }

    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        document: next,
        past: [...state.past, state.document].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        dirty: true,
        selectedId: findNode(next, state.selectedId ?? "") ? state.selectedId : null,
      };
    }

    case "saved":
      return { ...state, dirty: false };

    default:
      return state;
  }
}

export function initialBuilderState(document: PageDocument): BuilderState {
  return {
    document,
    selectedId: null,
    breakpoint: "desktop",
    past: [],
    future: [],
    dirty: false,
    clipboard: null,
  };
}

export type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: number }
  | { state: "error"; message: string };

/**
 * Debounced autosave.
 *
 * Saves a few seconds after the last change rather than on every keystroke, so
 * typing a paragraph is one write instead of forty. The latest document is
 * kept in a ref so the timer always sends current content, never the version
 * captured when the timer started.
 */
export function useAutosave({
  document,
  dirty,
  enabled,
  delayMs = 2500,
  onSave,
}: {
  document: PageDocument;
  dirty: boolean;
  enabled: boolean;
  delayMs?: number;
  onSave: (document: PageDocument) => Promise<{ ok: boolean; error?: string }>;
}): { status: SaveStatus; saveNow: () => Promise<boolean> } {
  const [status, setStatus] = React.useState<SaveStatus>({ state: "idle" });
  const latest = React.useRef(document);
  const saving = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  latest.current = document;

  const save = React.useCallback(async (): Promise<boolean> => {
    if (saving.current) return false;
    saving.current = true;
    setStatus({ state: "saving" });
    try {
      const result = await onSave(latest.current);
      if (result.ok) {
        setStatus({ state: "saved", at: Date.now() });
        return true;
      }
      setStatus({ state: "error", message: result.error || "Could not save." });
      return false;
    } catch {
      setStatus({ state: "error", message: "Could not reach the server." });
      return false;
    } finally {
      saving.current = false;
    }
  }, [onSave]);

  React.useEffect(() => {
    if (!enabled || !dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [document, dirty, enabled, delayMs, save]);

  // Warn before leaving with changes that have not reached the server.
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  return { status, saveNow: save };
}

/** Keyboard shortcuts: undo, redo, copy, duplicate, delete, save. */
export function useBuilderShortcuts({
  dispatch,
  selectedId,
  onSave,
}: {
  dispatch: React.Dispatch<BuilderAction>;
  selectedId: string | null;
  onSave: () => void;
}) {
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never hijack keys while someone is typing.
      const typing =
        Boolean(target?.isContentEditable) ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");

      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave();
        return;
      }

      if (typing) return;

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      if (!selectedId) return;

      if (mod && event.key.toLowerCase() === "c") {
        dispatch({ type: "copy", id: selectedId });
        return;
      }
      if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        dispatch({ type: "duplicate", id: selectedId });
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        dispatch({ type: "remove", id: selectedId });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch, selectedId, onSave]);
}

/** Build a node for a type, used by both the library and the templates. */
export function nodeFor(type: string): BuilderNode {
  return createNode(type);
}

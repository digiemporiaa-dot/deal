import {
  type BuilderNode,
  type NodeContent,
  type NodeSettings,
  type PageDocument,
  EMPTY_DOCUMENT,
} from "@/lib/builder/schema";
import { canNest, getElementDef } from "@/lib/builder/registry";

/**
 * Immutable operations on a builder document.
 *
 * Every function returns a new document rather than mutating the old one,
 * which is what makes undo/redo a matter of keeping a stack of past documents
 * instead of replaying inverse operations.
 *
 * Shared by the editor (client) and the server actions, so it stays free of
 * React and of database imports.
 */

let counter = 0;

/**
 * A collision-resistant node id.
 *
 * Deliberately not an array index: ids survive reordering, which is what
 * keeps React keys, selection and drag-and-drop stable while the tree moves.
 */
export function createId(prefix = "n"): string {
  counter = (counter + 1) % 100_000;
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${time}${random}${counter.toString(36)}`;
}

/** Build a fresh node of `type`, seeded from the registry defaults. */
export function createNode(type: string, overrides: Partial<BuilderNode> = {}): BuilderNode {
  const def = getElementDef(type);
  if (!def) throw new Error(`Unknown element type: ${type}`);

  const node: BuilderNode = {
    id: createId(type.slice(0, 6).toLowerCase()),
    type,
    content: structuredClone(def.defaultContent),
    settings: structuredClone(def.defaultSettings),
    ...overrides,
  };

  // Layout elements are useless empty, so they come pre-populated.
  if (!overrides.children) {
    if (type === "section") {
      node.children = [createNode("container")];
    } else if (type === "columns") {
      const count = Number(def.defaultContent.preset ?? 2) || 2;
      node.children = Array.from({ length: count }, () => createNode("column"));
    }
  }

  return node;
}

/** A ready-to-use section containing one element. */
export function createSectionWith(childType: string): BuilderNode {
  const section = createNode("section");
  const container = section.children?.[0];
  if (container) container.children = [createNode(childType)];
  return section;
}

export type NodeLocation = {
  node: BuilderNode;
  /** null when the node is a top-level section. */
  parent: BuilderNode | null;
  index: number;
};

/** Depth-first search for a node, with its parent and position. */
export function findNode(doc: PageDocument, id: string): NodeLocation | null {
  function walk(nodes: BuilderNode[], parent: BuilderNode | null): NodeLocation | null {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]!;
      if (node.id === id) return { node, parent, index };
      if (node.children?.length) {
        const found = walk(node.children, node);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(doc.sections, null);
}

/** Every ancestor of `id`, outermost first. Used for the breadcrumb bar. */
export function findAncestors(doc: PageDocument, id: string): BuilderNode[] {
  const trail: BuilderNode[] = [];

  function walk(nodes: BuilderNode[], path: BuilderNode[]): boolean {
    for (const node of nodes) {
      if (node.id === id) {
        trail.push(...path);
        return true;
      }
      if (node.children?.length && walk(node.children, [...path, node])) return true;
    }
    return false;
  }

  walk(doc.sections, []);
  return trail;
}

/** Replace one node, leaving the rest of the tree identical. */
function replaceNode(
  nodes: BuilderNode[],
  id: string,
  replacer: (node: BuilderNode) => BuilderNode | null,
): BuilderNode[] {
  const out: BuilderNode[] = [];
  for (const node of nodes) {
    if (node.id === id) {
      const replacement = replacer(node);
      if (replacement) out.push(replacement);
      continue;
    }
    out.push(
      node.children?.length
        ? { ...node, children: replaceNode(node.children, id, replacer) }
        : node,
    );
  }
  return out;
}

export function updateNode(
  doc: PageDocument,
  id: string,
  patch: { content?: NodeContent; settings?: NodeSettings },
): PageDocument {
  return {
    ...doc,
    sections: replaceNode(doc.sections, id, (node) => ({
      ...node,
      ...(patch.content ? { content: { ...node.content, ...patch.content } } : {}),
      ...(patch.settings ? { settings: mergeSettings(node.settings, patch.settings) } : {}),
    })),
  };
}

/** Merge settings one breakpoint at a time so a tablet edit cannot wipe desktop. */
function mergeSettings(current: NodeSettings | undefined, patch: NodeSettings): NodeSettings {
  const base = current ?? {};
  return {
    ...base,
    ...patch,
    desktop: patch.desktop ? { ...base.desktop, ...patch.desktop } : base.desktop,
    tablet: patch.tablet ? { ...base.tablet, ...patch.tablet } : base.tablet,
    mobile: patch.mobile ? { ...base.mobile, ...patch.mobile } : base.mobile,
    advanced: patch.advanced ? { ...base.advanced, ...patch.advanced } : base.advanced,
    hidden: patch.hidden ? { ...base.hidden, ...patch.hidden } : base.hidden,
  };
}

export function removeNode(doc: PageDocument, id: string): PageDocument {
  return { ...doc, sections: replaceNode(doc.sections, id, () => null) };
}

/** Give a node and everything under it brand-new ids. */
export function regenerateIds(node: BuilderNode): BuilderNode {
  return {
    ...node,
    id: createId(node.type.slice(0, 6).toLowerCase()),
    children: node.children?.map(regenerateIds),
  };
}

export function duplicateNode(doc: PageDocument, id: string): PageDocument {
  const found = findNode(doc, id);
  if (!found) return doc;

  const copy = regenerateIds(found.node);

  if (!found.parent) {
    const sections = [...doc.sections];
    sections.splice(found.index + 1, 0, copy);
    return { ...doc, sections };
  }

  return {
    ...doc,
    sections: replaceNode(doc.sections, found.parent.id, (parent) => {
      const children = [...(parent.children ?? [])];
      children.splice(found.index + 1, 0, copy);
      return { ...parent, children };
    }),
  };
}

export type InsertTarget = {
  /** null inserts at the top level, as a section. */
  parentId: string | null;
  /** Omitted appends to the end. */
  index?: number;
};

export function insertNode(
  doc: PageDocument,
  node: BuilderNode,
  target: InsertTarget,
): PageDocument {
  if (target.parentId === null) {
    const sections = [...doc.sections];
    sections.splice(target.index ?? sections.length, 0, node);
    return { ...doc, sections };
  }

  const parent = findNode(doc, target.parentId);
  if (!parent) return doc;
  if (!canNest(parent.node.type, node.type)) return doc;

  return {
    ...doc,
    sections: replaceNode(doc.sections, target.parentId, (current) => {
      const children = [...(current.children ?? [])];
      children.splice(target.index ?? children.length, 0, node);
      return { ...current, children };
    }),
  };
}

/**
 * Move an existing node somewhere else.
 *
 * Refuses a move into the node's own subtree — dropping a section inside
 * itself would detach that whole branch from the document.
 */
export function moveNode(doc: PageDocument, id: string, target: InsertTarget): PageDocument {
  const found = findNode(doc, id);
  if (!found) return doc;

  if (target.parentId === id) return doc;
  if (target.parentId && isDescendant(found.node, target.parentId)) return doc;

  if (target.parentId !== null) {
    const parent = findNode(doc, target.parentId);
    if (!parent || !canNest(parent.node.type, found.node.type)) return doc;
  } else if (found.node.type !== "section") {
    // Only sections live at the top level.
    return doc;
  }

  // Compute the corrected index before removal, since removing an earlier
  // sibling shifts everything after it down by one.
  const sameParent =
    (found.parent?.id ?? null) === target.parentId && target.index !== undefined;
  const adjustedIndex =
    sameParent && target.index! > found.index ? target.index! - 1 : target.index;

  const without = removeNode(doc, id);
  return insertNode(without, found.node, { parentId: target.parentId, index: adjustedIndex });
}

export function isDescendant(node: BuilderNode, candidateId: string): boolean {
  for (const child of node.children ?? []) {
    if (child.id === candidateId) return true;
    if (isDescendant(child, candidateId)) return true;
  }
  return false;
}

/** Move a top-level section one place up or down. */
export function moveSection(doc: PageDocument, id: string, direction: -1 | 1): PageDocument {
  const index = doc.sections.findIndex((section) => section.id === id);
  if (index < 0) return doc;
  const next = index + direction;
  if (next < 0 || next >= doc.sections.length) return doc;

  const sections = [...doc.sections];
  const [moved] = sections.splice(index, 1);
  sections.splice(next, 0, moved!);
  return { ...doc, sections };
}

/** Change how many columns a columns row has, keeping existing content. */
export function setColumnCount(doc: PageDocument, id: string, count: number): PageDocument {
  const target = Math.max(1, Math.min(6, Math.floor(count)));

  return {
    ...doc,
    sections: replaceNode(doc.sections, id, (node) => {
      if (node.type !== "columns") return node;
      const children = [...(node.children ?? [])];

      while (children.length < target) children.push(createNode("column"));

      // Removing columns must not silently bin their content: anything in a
      // dropped column is appended to the last surviving one.
      if (children.length > target) {
        const removed = children.splice(target);
        const last = children[target - 1];
        if (last) {
          last.children = [
            ...(last.children ?? []),
            ...removed.flatMap((column) => column.children ?? []),
          ];
        }
      }

      return {
        ...node,
        content: { ...node.content, preset: String(target) },
        settings: mergeSettings(node.settings, { desktop: { columns: target } }),
        children,
      };
    }),
  };
}

export function countNodes(doc: PageDocument): number {
  let total = 0;
  function walk(nodes: BuilderNode[]) {
    for (const node of nodes) {
      total += 1;
      if (node.children?.length) walk(node.children);
    }
  }
  walk(doc.sections);
  return total;
}

/** Flatten the tree — used for search and for collecting FAQ schema. */
export function flattenNodes(doc: PageDocument): BuilderNode[] {
  const out: BuilderNode[] = [];
  function walk(nodes: BuilderNode[]) {
    for (const node of nodes) {
      out.push(node);
      if (node.children?.length) walk(node.children);
    }
  }
  walk(doc.sections);
  return out;
}

export function emptyDocument(): PageDocument {
  return structuredClone(EMPTY_DOCUMENT);
}

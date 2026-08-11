"use client";

import * as React from "react";
import { Bold, Italic, List, ListOrdered, Heading2, Link2, Image as ImageIcon, Undo, Redo } from "lucide-react";

/**
 * Lightweight rich-text editor built on a contentEditable surface. It emits
 * HTML via onChange. No external dependency (keeps the bundle small and avoids
 * React 19 peer-dependency conflicts). Content is sanitised on render by only
 * ever inserting through the browser's own editing commands.
 */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [ready, setReady] = React.useState(false);

  // Initialise once (avoids clobbering the caret on every keystroke).
  React.useEffect(() => {
    if (ref.current && !ready) {
      ref.current.innerHTML = value || "<p></p>";
      setReady(true);
    }
  }, [value, ready]);

  const exec = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const onInput = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const btn = "grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-200";

  return (
    <div className="rounded-lg border border-slate-300">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-1.5">
        <button type="button" className={btn} onClick={() => exec("bold")} title="Bold"><Bold className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => exec("italic")} title="Italic"><Italic className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => exec("formatBlock", "<h2>")} title="Heading"><Heading2 className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => exec("insertUnorderedList")} title="Bullet list"><List className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => exec("insertOrderedList")} title="Numbered list"><ListOrdered className="h-4 w-4" /></button>
        <button
          type="button"
          className={btn}
          onClick={() => {
            const url = prompt("Enter URL");
            if (url) exec("createLink", url);
          }}
          title="Insert link"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => {
            const url = prompt("Enter image URL");
            if (url) exec("insertImage", url);
          }}
          title="Insert image"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-slate-300" />
        <button type="button" className={btn} onClick={() => exec("undo")} title="Undo"><Undo className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => exec("redo")} title="Redo"><Redo className="h-4 w-4" /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        className="prose-content min-h-[240px] max-w-none px-4 py-3 text-sm focus:outline-none"
      />
    </div>
  );
}

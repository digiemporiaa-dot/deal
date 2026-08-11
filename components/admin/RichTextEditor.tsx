"use client";

import * as React from "react";
import { Bold, Italic, List, ListOrdered, Link2, Image as ImageIcon, Undo, Redo } from "lucide-react";

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

  // Stops toolbar buttons from stealing the text selection in the editor.
  const keepSelection = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="rounded-lg border border-slate-300">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-1.5">
        <button type="button" className={btn} onMouseDown={keepSelection} onClick={() => exec("bold")} title="Bold"><Bold className="h-4 w-4" /></button>
        <button type="button" className={btn} onMouseDown={keepSelection} onClick={() => exec("italic")} title="Italic"><Italic className="h-4 w-4" /></button>
        <select
          className="h-8 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-700"
          defaultValue=""
          title="Heading level"
          onChange={(e) => {
            const v = e.target.value;
            if (v) exec("formatBlock", v);
            e.target.value = "";
          }}
        >
          <option value="" disabled>Heading</option>
          <option value="<p>">Paragraph</option>
          <option value="<h1>">H1</option>
          <option value="<h2>">H2</option>
          <option value="<h3>">H3</option>
          <option value="<h4>">H4</option>
          <option value="<h5>">H5</option>
          <option value="<h6>">H6</option>
        </select>
        <button type="button" className={btn} onMouseDown={keepSelection} onClick={() => exec("insertUnorderedList")} title="Bullet list"><List className="h-4 w-4" /></button>
        <button type="button" className={btn} onMouseDown={keepSelection} onClick={() => exec("insertOrderedList")} title="Numbered list"><ListOrdered className="h-4 w-4" /></button>
        <button
          type="button"
          className={btn}
          onMouseDown={keepSelection}
          onClick={() => {
            // Remember what text is selected before the popups open.
            const selection = window.getSelection();
            const hasSelection =
              selection &&
              selection.rangeCount > 0 &&
              !selection.isCollapsed &&
              ref.current?.contains(selection.anchorNode);
            if (!hasSelection) {
              alert("First select the text you want to turn into a link, then click the link button.");
              return;
            }
            const savedRange = selection.getRangeAt(0).cloneRange();

            const url = prompt("Enter URL");
            if (!url) return;
            const nofollow = confirm(
              "Should this link be NOFOLLOW?\n\nOK = nofollow (external/untrusted sites)\nCancel = follow (normal link)",
            );

            // Restore the selection the popups may have cleared, then apply the link.
            selection.removeAllRanges();
            selection.addRange(savedRange);
            exec("createLink", url);

            // Apply rel to the link(s) just created.
            if (ref.current) {
              ref.current.querySelectorAll(`a[href="${CSS.escape(url)}"]`).forEach((a) => {
                if (nofollow) a.setAttribute("rel", "nofollow noopener");
                else a.removeAttribute("rel");
              });
              onChange(ref.current.innerHTML);
            }
          }}
          title="Insert link"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn}
          onMouseDown={keepSelection}
          onClick={() => {
            const selection = window.getSelection();
            const savedRange =
              selection && selection.rangeCount > 0 && ref.current?.contains(selection.anchorNode)
                ? selection.getRangeAt(0).cloneRange()
                : null;
            const url = prompt("Enter image URL");
            if (!url) return;
            if (savedRange && selection) {
              selection.removeAllRanges();
              selection.addRange(savedRange);
            }
            exec("insertImage", url);
          }}
          title="Insert image"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-slate-300" />
        <button type="button" className={btn} onMouseDown={keepSelection} onClick={() => exec("undo")} title="Undo"><Undo className="h-4 w-4" /></button>
        <button type="button" className={btn} onMouseDown={keepSelection} onClick={() => exec("redo")} title="Redo"><Redo className="h-4 w-4" /></button>
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

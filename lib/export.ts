import "server-only";

/** Escape one CSV cell — quotes doubled, whole value quoted when needed. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Stop spreadsheet formula injection from user-supplied text.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // BOM so Excel opens Hindi/₹ characters correctly.
  return `\uFEFF${lines.join("\r\n")}`;
}

function xmlCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Excel-readable workbook built as an HTML table with the .xls extension.
 * Excel, LibreOffice and Google Sheets all open this natively — and it needs
 * no external library, so nothing can break the build.
 */
export function toExcel(title: string, headers: string[], rows: unknown[][]): string {
  const head = headers.map((h) => `<th>${xmlCell(h)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((c) => `<td>${xmlCell(c)}</td>`).join("")}</tr>`)
    .join("");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${xmlCell(title)}</title>
<style>
  table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  th { background: #1b70f1; color: #ffffff; font-weight: bold; border: 1px solid #bfdbfe; padding: 6px 10px; text-align: left; }
  td { border: 1px solid #e2e8f0; padding: 5px 10px; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
</style></head>
<body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

export function exportFileName(base: string, format: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}-${stamp}.${format === "excel" ? "xls" : format}`;
}

export const EXPORT_CONTENT_TYPE: Record<string, string> = {
  csv: "text/csv; charset=utf-8",
  excel: "application/vnd.ms-excel; charset=utf-8",
  json: "application/json; charset=utf-8",
};

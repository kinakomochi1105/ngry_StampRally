/**
 * One CSV cell. A value a spreadsheet would read as a formula (=, +, -, @, or
 * a leading tab or line break) gets a leading apostrophe, so a nickname can
 * never run as one when the export is opened.
 */
export function csvCell(value: string | number | null | undefined) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

/** Rows joined with CRLF, behind a UTF-8 BOM so Excel reads Japanese correctly. */
export const csvDocument = (rows: (string | number | null | undefined)[][]) =>
  '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');

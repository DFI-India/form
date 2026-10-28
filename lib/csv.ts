/**
 * Turning values into spreadsheet cells.
 *
 * Excel and LibreOffice treat a cell starting with =, +, - or @ as a formula
 * and evaluate it on open. Our data is typed by volunteers in the field, and a
 * report goes to funders and government offices, so a cell reading
 * `=HYPERLINK(...)` would execute on their machine rather than ours. Prefixing
 * a single quote makes the spreadsheet treat it as text; the quote is not shown
 * once the file is opened.
 */
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
  const guarded = FORMULA_START.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

/** Rows of already-ordered values into a complete CSV document. */
export const toCsv = (header: string[], rows: unknown[][]): string =>
  [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n')

/**
 * A filename safe to use as a storage path segment.
 *
 * Uploads were named from `file.name` with only spaces replaced, so a file
 * called `../../avatar.png` would have been written somewhere other than the
 * folder intended. Slashes, dots-only names and anything exotic are stripped,
 * leaving a recognisable name.
 */
export function safeFileName(name: string, fallback = 'upload'): string {
  const base = (name.split(/[\\/]/).pop() || '').trim()
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 80)
  return cleaned || fallback
}

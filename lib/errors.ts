/**
 * Extracts a human-readable message from a caught error.
 *
 * Supabase's PostgrestError/AuthError/StorageError objects are plain
 * `{ message, details, hint, code }` objects, not real `Error` instances —
 * an `error instanceof Error` check misses them entirely and silently
 * discards the actual reason (e.g. "duplicate key value violates unique
 * constraint"). This checks for a usable `.message` on anything error-shaped
 * before falling back.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string' &&
    (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message
  }
  return fallback
}

/**
 * Make a search term safe to drop inside a PostgREST `or(...)` filter.
 *
 * That filter is a comma-separated list, so a term containing a comma, a
 * parenthesis or a quote changes the structure of the filter rather than being
 * matched literally. Searching for "Kumar,gender.eq.Male" should look for that
 * string, not add a condition.
 */
export const safeFilterTerm = (value: string) =>
  value.replace(/[(),"\\*]/g, ' ').trim()

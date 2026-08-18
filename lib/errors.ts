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

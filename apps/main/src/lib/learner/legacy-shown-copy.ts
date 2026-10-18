/**
 * Until every learner write hands back its revision (the cutover), a copy shown older than this is
 * read again when its screen shows, as other pages check themselves on show
 * (`useRefreshWhenOld`): writes that don't say their revision yet (a session block's answers and
 * finish, the lesson player's) still reach Today, as one view read, never a page refresh. Never
 * twice within it, so a server clock ahead of the browser's can't loop. The cutover deletes this
 * module.
 */
const LEGACY_SHOWN_COPY_FRESH_MS = 3000;

/**
 * Whether a shown copy is older than legacy freshness allowed on show, and wasn't just read: a copy
 * a read of this tab brought counts from when it arrived (`arrivedAt`), so a slow answer never
 * reads again, and nothing reads twice within the window (`lastSent`, the view's last read).
 */
export function isShownCopyStale({
  arrivedAt,
  lastSent,
  readAt,
}: {
  arrivedAt: number | null;
  lastSent: number;
  readAt: number;
}): boolean {
  const now = Date.now();

  return (
    now - (arrivedAt ?? readAt) > LEGACY_SHOWN_COPY_FRESH_MS &&
    now - lastSent > LEGACY_SHOWN_COPY_FRESH_MS
  );
}

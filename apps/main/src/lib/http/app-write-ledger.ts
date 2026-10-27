/**
 * Learner writes whose screen doesn't render again when they save: posts to the app's own routes
 * (`postToApp`) and Server Actions that leave the page alone, such as opening a day's step. Next.js
 * drops the pages the router keeps only after a Server Action that expires tags, so the screen that
 * sent these refreshes the router once when it closes (`useRefreshAfterAppWrites`).
 */
const writes = new Set<Promise<unknown>>();

/** A write on its way. It counts from the moment it's sent: one whose answer never came may have saved. */
export function noteAppWrite<T>(request: Promise<T>): Promise<T> {
  writes.add(request);
  return request;
}

/**
 * Takes every write noted so far and waits for them to settle: true when there was any. A write
 * sent after, from the next screen, stays for that screen's own refresh.
 */
export async function takeSettledAppWrites(): Promise<boolean> {
  const sent = [...writes];
  writes.clear();
  await Promise.allSettled(sent);
  return sent.length > 0;
}

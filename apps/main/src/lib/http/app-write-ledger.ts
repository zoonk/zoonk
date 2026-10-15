/**
 * The writes the app's own routes (`postToApp`) sent since the router last dropped the pages it
 * keeps, each with whether it settled. A Server Action that changes cached data drops every kept
 * and prefetched page, which is how each answer used to keep the notebook or a chapter right; the
 * routes don't. Until the learner revision says which pages are older than the learner's latest
 * write, a screen that sent writes refreshes the router once when it closes (`useRefreshAfterAppWrites`).
 * A write counts from the moment it's sent, since one whose response never arrived may still have
 * been saved, and each refresh covers exactly the writes it waited for: one sent later, from the
 * next screen, stays for that screen's own refresh.
 */
const writes = new Map<Promise<unknown>, { settled: boolean }>();

/** A write to one of the app's routes, on its way. */
export function noteAppWrite<T>(request: Promise<T>): Promise<T> {
  const write = { settled: false };

  const settle = () => {
    write.settled = true;
  };

  writes.set(request, write);
  void request.then(settle, settle);
  return request;
}

/** A Server Action that changed cached data (a lesson's completion) dropped every page after them. */
export function forgetAppWrites(): void {
  for (const [request, write] of writes) {
    if (write.settled) {
      writes.delete(request);
    }
  }
}

/**
 * Waits for the writes sent so far to settle and takes them: true when any of them wasn't taken by
 * another screen's refresh or forgotten meanwhile, so a refresh now is the one that shows them.
 */
export async function takeSettledAppWrites(): Promise<boolean> {
  const sent = [...writes.keys()];
  await Promise.allSettled(sent);

  const untaken = sent.filter((request) => writes.has(request));

  for (const request of untaken) {
    writes.delete(request);
  }

  return untaken.length > 0;
}

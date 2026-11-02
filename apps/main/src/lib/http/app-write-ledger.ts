import { getBrowserApiUrl } from "@/lib/browser-api-url";

/**
 * Next.js drops the pages it keeps only after a Server Action that expires tags, so other writes
 * leave them stale. `RefreshStalePages` reads them again once these settle.
 */
const writes = new Set<{ page: string; request: Promise<unknown>; settled: boolean }>();

/** A read covers only writes settled before it started, never one still on its way. */
let changed = 0;
let refreshed = 0;
const reads = new Map<string, { version: number; succeeded: Promise<boolean> }>();

/** Tells the browser's other tabs; a channel never hears its own messages. */
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  channel ??= typeof document === "undefined" ? null : new BroadcastChannel("zoonk-writes");
  return channel;
}

function announceWrite() {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- A BroadcastChannel has no target origin.
  getChannel()?.postMessage(null);
}

/** Counts from the moment it's sent: a write whose answer never came may have saved. */
export function noteAppWrite<T>(request: Promise<T>): Promise<T> {
  const write = { page: location.pathname, request, settled: false };
  changed += 1;

  const settle = () => {
    write.settled = true;
    changed += 1;
    announceWrite();
  };

  writes.add(write);
  void request.then(settle, settle);
  return request;
}

/**
 * A navigation's own server read can cover the writes, but only for its destination: another page
 * kept from before still needs a refresh. A refresh clears Next's page caches for every destination.
 */
export async function takeSettledAppWrites({
  from,
  to,
}: { from?: string; to?: string } = {}): Promise<boolean> {
  const sent = [...writes].filter((write) => from === undefined || write.page === from);
  sent.forEach((write) => writes.delete(write));
  await Promise.allSettled(sent.map((write) => write.request));
  [...writes].filter((write) => write.settled).forEach((write) => writes.delete(write));

  if (changed === refreshed) {
    return false;
  }

  const read = to === undefined ? undefined : reads.get(to);

  // Next can commit the prefetched shell before this navigation's live response arrives.
  if (read?.version === changed && (await read.succeeded) && read.version === changed) {
    return false;
  }

  refreshed = changed;
  reads.clear();
  return true;
}

export function onOtherTabWrite(onWrite: () => void): () => void {
  const listening = getChannel();
  listening?.addEventListener("message", onWrite);
  return () => listening?.removeEventListener("message", onWrite);
}

function isAppWrite(input: RequestInfo | URL, init?: RequestInit): boolean {
  const request = input instanceof Request ? input : null;
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();

  if (method === "GET" || method === "HEAD") {
    return false;
  }

  const url = new URL(input instanceof Request ? input.url : input, location.href);
  const api = new URL(getBrowserApiUrl());

  return (
    (url.origin === location.origin && url.pathname.startsWith("/api/")) ||
    (url.origin === api.origin && url.pathname.startsWith("/v1/"))
  );
}

/**
 * Server Actions post to the page's address, so one that leaves the page alone notes itself where
 * it's called. Runs once before hydration (`instrumentation-client.ts`).
 */
export function noteAppWritesSent(): void {
  const send = globalThis.fetch;

  globalThis.fetch = (input, init) => {
    const readVersion = changed;
    const response = send(input, init);

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );

    const url = new URL(input instanceof Request ? input.url : input, location.href);

    if (
      url.origin === location.origin &&
      headers.get("RSC") === "1" &&
      !headers.has("Next-Router-Prefetch") &&
      !headers.get("Next-Router-State-Tree")?.includes("metadata-only")
    ) {
      reads.set(url.pathname, {
        succeeded: response.then(
          (result) => result.ok,
          () => false,
        ),
        version: readVersion,
      });
    }

    if (isAppWrite(input, init)) {
      void noteAppWrite(response);
    }

    return response;
  };
}

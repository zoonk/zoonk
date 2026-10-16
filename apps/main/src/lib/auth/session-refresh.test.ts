import { SESSION_COPY_REFRESH_MS, SESSION_REFRESH_PATH } from "@zoonk/auth/session-refresh";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const RETRY_MS = 5 * MINUTE_MS;

type Answer = "ok" | "unavailable" | "offline";

/**
 * The browser's Web Locks, shared by its tabs: one tab holds the lock at a time, the others wait
 * in order, and every grant comes asynchronously.
 */
function stubLocks() {
  let released = Promise.resolve();

  return {
    request: (_name: string, work: () => Promise<void>) => {
      const granted = released.then(() => work());
      released = granted.catch(() => {});
      return granted;
    },
  };
}

/** What the browser's pages listen for on their document, in the order they asked. */
const documentListeners: { listener: () => void; type: string }[] = [];

/**
 * A browser and its tabs: whether they're visible, whether storage works, and how the server
 * answers each refresh, in order (a promise answers once it settles). Records the requests sent
 * and the answers, each with a body as the server's has.
 */
function stubTab({
  answers,
  storage = "works",
  visible = true,
}: {
  answers: (Answer | Promise<Answer>)[];
  storage?: "blocked" | "works";
  visible?: boolean;
}) {
  const stored = new Map<string, string>();
  const sent: { method: string; url: string }[] = [];
  const answered: Response[] = [];

  documentListeners.splice(0);

  vi.stubGlobal("document", {
    addEventListener: (type: string, listener: () => void) => {
      documentListeners.push({ listener, type });
    },
    removeEventListener: (type: string, listener: () => void) => {
      const index = documentListeners.findIndex(
        (entry) => entry.type === type && entry.listener === listener,
      );

      if (index !== -1) {
        documentListeners.splice(index, 1);
      }
    },
    visibilityState: visible ? "visible" : "hidden",
  });

  vi.stubGlobal("navigator", { locks: stubLocks() });

  vi.stubGlobal("localStorage", {
    getItem: (key: string) => {
      if (storage === "blocked") {
        throw new Error("storage blocked");
      }

      return stored.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (storage === "blocked") {
        throw new Error("storage blocked");
      }

      stored.set(key, value);
    },
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      sent.push({ method: init?.method ?? "GET", url });
      const answer = await (answers.shift() ?? "ok");

      if (answer === "offline") {
        throw new TypeError("Failed to fetch");
      }

      const response = Response.json({ session: null }, { status: answer === "ok" ? 200 : 503 });
      answered.push(response);
      return response;
    }),
  );

  return { answered, sent };
}

/** A fresh page: the watcher keeps its own record per page. */
async function openPage({ hasSession = () => true }: { hasSession?: () => boolean } = {}) {
  vi.resetModules();
  const { watchSessionRefresh } = await import("./session-refresh");
  const listeners = new Set<() => void>();
  const listenedBefore = documentListeners.length;

  const stop = watchSessionRefresh({
    hasSession,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  const taps = documentListeners
    .slice(listenedBefore)
    .filter(({ type }) => type === "pointerdown")
    .map(({ listener }) => listener);

  /** The learner summary changed (a page read it again). */
  async function notify() {
    listeners.forEach((listener) => listener());
    await vi.advanceTimersByTimeAsync(0);
  }

  /** The learner taps this page. */
  async function tap() {
    taps.forEach((listener) => listener());
    await vi.advanceTimersByTimeAsync(0);
  }

  await vi.advanceTimersByTimeAsync(0);
  return { notify, stop, tap };
}

describe("session copy refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 15, 12) });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reads the session with one GET every 50 minutes while the learner uses the browser, before the copy runs out, whatever its tabs", async () => {
    const { sent } = stubTab({ answers: [] });
    const first = await openPage();
    const second = await openPage();
    // Two hours of use, with a tap in each tab every five minutes.
    const minutes = Array.from({ length: 25 }, (_, step) => step * 5);

    const sentAtMinute = await minutes.reduce<Promise<number[]>>(async (previous, minute) => {
      const sentBefore = await previous;
      const before = sent.length;
      await first.tap();
      await second.tap();
      const sentNow = Array.from({ length: sent.length - before }, () => minute);
      await vi.advanceTimersByTimeAsync(5 * MINUTE_MS);
      return [...sentBefore, ...sentNow];
    }, Promise.resolve([]));

    // Each copy lasts an hour, so the next one comes while it's still good.
    expect(sentAtMinute).toStrictEqual([0, 50, 100]);

    expect(new Set(sent.map(({ method, url }) => `${method} ${url}`))).toStrictEqual(
      new Set([`GET ${SESSION_REFRESH_PATH}`]),
    );

    first.stop();
    second.stop();
  });

  it("reads every answer to its end, an error's included, so its request doesn't stay open", async () => {
    const { answered } = stubTab({ answers: ["unavailable", "ok"] });
    const { stop, tap } = await openPage();

    await tap();
    await vi.advanceTimersByTimeAsync(3 * MINUTE_MS);
    await tap();
    await vi.advanceTimersByTimeAsync(2 * MINUTE_MS);

    expect(answered.map(({ bodyUsed, status }) => ({ bodyUsed, status }))).toStrictEqual([
      { bodyUsed: true, status: 503 },
      { bodyUsed: true, status: 200 },
    ]);

    stop();
  });

  it("asks nothing from an idle tab, a hidden one, or a page without a learner", async () => {
    const idle = stubTab({ answers: [] });
    const idlePage = await openPage();
    await vi.advanceTimersByTimeAsync(2 * 60 * MINUTE_MS);
    await idlePage.notify();
    idlePage.stop();
    expect(idle.sent).toStrictEqual([]);

    const hidden = stubTab({ answers: [], visible: false });
    const hiddenPage = await openPage();
    await hiddenPage.tap();
    hiddenPage.stop();
    expect(hidden.sent).toStrictEqual([]);

    const visitor = stubTab({ answers: [] });
    const visitorPage = await openPage({ hasSession: () => false });
    await visitorPage.tap();
    visitorPage.stop();
    expect(visitor.sent).toStrictEqual([]);
  });

  it("asks nothing from a page left alone once its copy is old, until the learner is back", async () => {
    const { sent } = stubTab({ answers: [] });
    const { notify, stop, tap } = await openPage();
    await tap();
    await vi.advanceTimersByTimeAsync(SESSION_COPY_REFRESH_MS + 10 * MINUTE_MS);
    await notify();
    expect(sent).toHaveLength(1);

    await tap();
    expect(sent).toHaveLength(2);
    stop();
  });

  it("asks once the learner summary shows a learner the learner already tapped for", async () => {
    const { sent } = stubTab({ answers: [] });
    const learner = { ready: false };
    const { notify, stop, tap } = await openPage({ hasSession: () => learner.ready });

    await tap();
    expect(sent).toHaveLength(0);

    learner.ready = true;
    await notify();
    expect(sent).toHaveLength(1);
    stop();
  });

  it("tries a failed refresh again a few minutes later while the learner uses the page, an error answer included", async () => {
    const { sent } = stubTab({ answers: ["unavailable", "offline", "ok"] });
    const { stop, tap } = await openPage();

    await tap();
    expect(sent).toHaveLength(1);

    // A tap during the wait asks nothing; the retry goes when the wait ends.
    await vi.advanceTimersByTimeAsync(3 * MINUTE_MS);
    await tap();
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2 * MINUTE_MS);
    expect(sent).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(3 * MINUTE_MS);
    await tap();
    await vi.advanceTimersByTimeAsync(2 * MINUTE_MS);
    expect(sent).toHaveLength(3);

    // A new copy: nothing more for a while.
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    await tap();
    expect(sent).toHaveLength(3);

    stop();
  });

  it("asks nothing more once the page that was refreshing closes", async () => {
    const answer = Promise.withResolvers<Answer>();
    const { sent } = stubTab({ answers: [answer.promise] });

    const { stop, tap } = await openPage();
    await tap();
    expect(sent).toHaveLength(1);

    stop();
    answer.resolve("unavailable");
    await vi.advanceTimersByTimeAsync(2 * RETRY_MS);
    expect(sent).toHaveLength(1);
  });

  it("refreshes again once the device's clock is set back", async () => {
    const { sent } = stubTab({ answers: ["ok", "unavailable", "ok"] });
    const { stop, tap } = await openPage();

    // Refreshed while the clock ran 40 days fast, then the clock was corrected.
    vi.setSystemTime(Date.now() + 40 * DAY_MS);
    await tap();
    expect(sent).toHaveLength(1);

    vi.setSystemTime(Date.now() - 40 * DAY_MS);
    await tap();
    expect(sent).toHaveLength(2);

    // That refresh failed; an hour back, its few minutes' wait doesn't last an hour.
    vi.setSystemTime(Date.now() - 60 * MINUTE_MS);
    await tap();
    expect(sent).toHaveLength(3);

    stop();
  });

  it("keeps the copy fresh in a page whose storage is blocked", async () => {
    const { sent } = stubTab({ answers: ["ok", "ok"], storage: "blocked" });
    const { stop, tap } = await openPage();

    await tap();
    expect(sent).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(10 * MINUTE_MS);
    await tap();
    expect(sent).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(SESSION_COPY_REFRESH_MS);
    await tap();
    expect(sent).toHaveLength(2);

    stop();
  });

  it("leaves the refresh to the tab already refreshing", async () => {
    const answer = Promise.withResolvers<Answer>();
    const { sent } = stubTab({ answers: [answer.promise] });

    const refreshing = await openPage();
    const waiting = await openPage();
    await refreshing.tap();
    await waiting.tap();
    expect(sent).toHaveLength(1);

    answer.resolve("ok");
    await vi.advanceTimersByTimeAsync(0);
    await waiting.tap();
    expect(sent).toHaveLength(1);

    refreshing.stop();
    waiting.stop();
  });

  it("takes the refresh over from a tab whose refresh failed", async () => {
    const answer = Promise.withResolvers<Answer>();
    const { sent } = stubTab({ answers: [answer.promise, "ok"] });

    const failing = await openPage();
    const waiting = await openPage();
    await failing.tap();
    await waiting.tap();
    expect(sent).toHaveLength(1);

    answer.resolve("unavailable");
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(2);

    // The waiting tab got the copy, so the failed tab's retry asks nothing.
    await failing.tap();
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(sent).toHaveLength(2);

    failing.stop();
    waiting.stop();
  });

  it("asks again on the learner's next tap when the browser refuses the lock", async () => {
    const { sent } = stubTab({ answers: ["ok"] });

    vi.spyOn(navigator.locks, "request").mockRejectedValueOnce(
      new DOMException("Web Locks are unavailable", "SecurityError"),
    );

    const { stop, tap } = await openPage();
    await tap();
    expect(sent).toHaveLength(0);

    await tap();
    expect(sent).toHaveLength(1);

    stop();
  });

  it("asks nothing once the browser drops a closed page's waiting claim", async () => {
    const { sent } = stubTab({ answers: [] });
    const claim = Promise.withResolvers<undefined>();
    vi.spyOn(navigator.locks, "request").mockReturnValueOnce(claim.promise);

    const { stop, tap } = await openPage();
    await tap();
    stop();

    claim.reject(new DOMException("The page was put away", "AbortError"));
    await vi.advanceTimersByTimeAsync(2 * RETRY_MS);
    expect(sent).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("asks nothing from a page that closed while waiting to refresh", async () => {
    const answer = Promise.withResolvers<Answer>();
    const { sent } = stubTab({ answers: [answer.promise] });

    const failing = await openPage();
    const closed = await openPage();
    await failing.tap();
    await closed.tap();
    closed.stop();

    answer.resolve("unavailable");
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1);

    failing.stop();
  });
});

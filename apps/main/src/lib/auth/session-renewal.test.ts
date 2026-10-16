import { SESSION_RENEWAL_PATH } from "@zoonk/auth/session-renewal";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;

/** A session last renewed three days ago: due today. */
const DUE_SESSION_END = () => Date.now() + 27 * DAY_MS;

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

/**
 * A browser and its tabs: whether they're visible, whether storage works, and how the server
 * answers each renewal, in order (a promise answers once it settles). Records the renewals sent.
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
  const sent: { method?: string; url: string }[] = [];

  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
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
      sent.push({ method: init?.method, url });
      const answer = await (answers.shift() ?? "ok");

      if (answer === "offline") {
        throw new TypeError("Failed to fetch");
      }

      return new Response(null, { status: answer === "ok" ? 200 : 503 });
    }),
  );

  return { sent };
}

/** A fresh page: the watcher keeps its own record per page. */
async function openPage({ sessionEnd }: { sessionEnd: () => number | null }) {
  vi.resetModules();
  const { watchSessionRenewal } = await import("./session-renewal");
  const listeners = new Set<() => void>();

  const stop = watchSessionRenewal({
    readSessionEnd: sessionEnd,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  /** The learner summary changed (a page read it again). */
  async function notify() {
    listeners.forEach((listener) => listener());
    await vi.advanceTimersByTimeAsync(0);
  }

  await vi.advanceTimersByTimeAsync(0);
  return { notify, stop };
}

describe("session renewal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 15, 12) });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renews a day-old session with one POST a day", async () => {
    const { sent } = stubTab({ answers: ["ok", "ok"] });
    const { notify, stop } = await openPage({ sessionEnd: DUE_SESSION_END });

    await notify();
    expect(sent).toStrictEqual([{ method: "POST", url: SESSION_RENEWAL_PATH }]);

    vi.setSystemTime(Date.now() + DAY_MS + 1000);
    await notify();
    expect(sent).toHaveLength(2);

    stop();
  });

  it("asks nothing for a session renewed today, a hidden tab, or a page without a learner", async () => {
    const hidden = stubTab({ answers: [], visible: false });
    const hiddenPage = await openPage({ sessionEnd: DUE_SESSION_END });
    hiddenPage.stop();
    expect(hidden.sent).toStrictEqual([]);

    const fresh = stubTab({ answers: [] });
    const renewedToday = await openPage({ sessionEnd: () => Date.now() + 29.5 * DAY_MS });
    const nobody = await openPage({ sessionEnd: () => null });
    renewedToday.stop();
    nobody.stop();
    expect(fresh.sent).toStrictEqual([]);
  });

  it("tries a failed renewal again a few minutes later, an error answer included", async () => {
    const { sent } = stubTab({ answers: ["unavailable", "offline", "ok"] });
    const { notify, stop } = await openPage({ sessionEnd: () => Date.now() + 5 * 60 * 1000 });

    await notify();
    expect(sent).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(sent).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(sent).toHaveLength(3);

    // Renewed: nothing more today.
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    await notify();
    expect(sent).toHaveLength(3);

    stop();
  });

  it("asks nothing more once the page that was renewing closes", async () => {
    const answer = Promise.withResolvers<Answer>();
    const { sent } = stubTab({ answers: [answer.promise] });

    const { stop } = await openPage({ sessionEnd: DUE_SESSION_END });
    expect(sent).toHaveLength(1);

    stop();
    answer.resolve("unavailable");
    await vi.advanceTimersByTimeAsync(2 * RETRY_MS);
    expect(sent).toHaveLength(1);
  });

  it("renews again once the device's clock is set back", async () => {
    const { sent } = stubTab({ answers: ["ok", "unavailable", "ok"] });

    // Renewed while the clock ran 40 days fast, then the clock was corrected.
    vi.setSystemTime(Date.now() + 40 * DAY_MS);
    const { notify, stop } = await openPage({ sessionEnd: DUE_SESSION_END });
    expect(sent).toHaveLength(1);

    vi.setSystemTime(Date.now() - 40 * DAY_MS);
    await notify();
    expect(sent).toHaveLength(2);

    // That renewal failed; an hour back, its few minutes' wait doesn't last an hour.
    vi.setSystemTime(Date.now() - 60 * 60 * 1000);
    await notify();
    expect(sent).toHaveLength(3);

    stop();
  });

  it("keeps renewing every day in a page whose storage is blocked", async () => {
    const { sent } = stubTab({ answers: ["ok", "ok"], storage: "blocked" });
    const { notify, stop } = await openPage({ sessionEnd: DUE_SESSION_END });

    await notify();
    expect(sent).toHaveLength(1);

    vi.setSystemTime(Date.now() + DAY_MS + 1000);
    await notify();
    expect(sent).toHaveLength(2);

    stop();
  });

  it("leaves the renewal to the tab already renewing", async () => {
    const answer = Promise.withResolvers<Answer>();
    const { sent } = stubTab({ answers: [answer.promise] });

    const renewing = await openPage({ sessionEnd: DUE_SESSION_END });
    const waiting = await openPage({ sessionEnd: DUE_SESSION_END });
    await waiting.notify();
    expect(sent).toHaveLength(1);

    answer.resolve("ok");
    await vi.advanceTimersByTimeAsync(0);
    await waiting.notify();
    expect(sent).toHaveLength(1);

    renewing.stop();
    waiting.stop();
  });

  it("takes the renewal over from a tab whose renewal failed, with no new reason to ask", async () => {
    const answer = Promise.withResolvers<Answer>();
    const { sent } = stubTab({ answers: [answer.promise, "ok"] });

    const failing = await openPage({ sessionEnd: DUE_SESSION_END });
    const waiting = await openPage({ sessionEnd: DUE_SESSION_END });
    expect(sent).toHaveLength(1);

    answer.resolve("unavailable");
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(2);

    // The waiting tab renewed, so the failed tab's retry asks nothing.
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(sent).toHaveLength(2);

    failing.stop();
    waiting.stop();
  });

  it("tries again later when the browser refuses the lock", async () => {
    const { sent } = stubTab({ answers: ["ok"] });

    vi.spyOn(navigator.locks, "request").mockRejectedValueOnce(
      new DOMException("Web Locks are unavailable", "SecurityError"),
    );

    const { stop } = await openPage({ sessionEnd: DUE_SESSION_END });
    expect(sent).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(sent).toHaveLength(1);

    stop();
  });

  it("asks nothing once the browser drops a closed page's waiting claim", async () => {
    const { sent } = stubTab({ answers: [] });
    const claim = Promise.withResolvers<undefined>();
    vi.spyOn(navigator.locks, "request").mockReturnValueOnce(claim.promise);

    const { stop } = await openPage({ sessionEnd: DUE_SESSION_END });
    stop();

    claim.reject(new DOMException("The page was put away", "AbortError"));
    await vi.advanceTimersByTimeAsync(2 * RETRY_MS);
    expect(sent).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("asks nothing from a page that closed while waiting to renew", async () => {
    const answer = Promise.withResolvers<Answer>();
    const { sent } = stubTab({ answers: [answer.promise] });

    const failing = await openPage({ sessionEnd: DUE_SESSION_END });
    const closed = await openPage({ sessionEnd: DUE_SESSION_END });
    closed.stop();

    answer.resolve("unavailable");
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1);

    failing.stop();
  });
});

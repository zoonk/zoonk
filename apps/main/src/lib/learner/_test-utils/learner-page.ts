import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { vi } from "vitest";
import { type IdentityCover } from "../identity-cover";
import { type LearnerSummaryResponse } from "../learner-summary-response";

const DAY_MS = 24 * 60 * 60 * 1000;

/** When every learner here signed in: one session each, however often it's read. */
const SIGNED_IN_AT = Date.now() - DAY_MS;

/** How many characters follow `t1.` in a tag (16 bytes in base64url). */
const TAG_LENGTH = 22;

/** A learner's session hint tag, well-formed like the server's. */
export function tagOf(userId: string): string {
  return `t1.${userId.padEnd(TAG_LENGTH, "0").slice(0, TAG_LENGTH)}`;
}

/** One learner's summary as the server read it now. */
export function summaryOf(userId: string, activeGoalId: string | null = null): LearnerSummary {
  const now = Date.now();

  return {
    account: { email: `${userId}@zoonk.test`, image: null, name: userId },
    activeGoalId,
    analytics: { disabled: false, goal: null, plan: "free", username: null },
    buddy: {
      beltColor: "white",
      energy: null,
      glasses: "round",
      kind: "zu",
      name: null,
      studiedToday: false,
    },
    day: null,
    goals: [],
    identity: {
      expiresAt: SIGNED_IN_AT + 2 * DAY_MS,
      isAnonymous: false,
      signedInAt: SIGNED_IN_AT,
      userId,
    },
    level: null,
    missions: null,
    nextChangeAt: now + DAY_MS,
    places: { exam: false, mindMaps: false, readyMistakes: 0, speaking: false },
    readAt: now,
    revision: "1",
    tier: "free",
    timeZone: null,
    today: null,
  };
}

/** The summary route's answer for a learner: their summary and their hint tag. */
export function answerFor(
  summary: LearnerSummary,
): Extract<LearnerSummaryResponse, { status: "ready" }> {
  return { status: "ready", summary, tag: tagOf(summary.identity.userId) };
}

/** A page's seed for a learner: their summary and their hint tag. */
export function seedFor(summary: LearnerSummary) {
  return { status: "ready", summary, tag: tagOf(summary.identity.userId) } as const;
}

/**
 * The summary reads and session checks a page sends, answered by the test in the order it picks.
 * A session check answers with the tag of whoever holds the session (null for nobody).
 */
export function stubReads() {
  const summaries: PromiseWithResolvers<LearnerSummaryResponse>[] = [];
  const sessions: PromiseWithResolvers<string | null>[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.startsWith("/api/auth/get-session")) {
        const check = Promise.withResolvers<string | null>();
        sessions.push(check);

        return check.promise.then((tag) => ({
          headers: new Headers({ "x-zoonk-session-hint": tag ?? "0" }),
          ok: true,
          status: 200,
        }));
      }

      const read = Promise.withResolvers<LearnerSummaryResponse>();
      summaries.push(read);
      return read.promise.then((body) => ({ json: async () => body, ok: true, status: 200 }));
    }),
  );

  return { sessions, summaries };
}

/** Summary reads the test answers by hand, in the order it picks. */
export function stubSummaryReads() {
  return stubReads().summaries;
}

/** Lets every answer given so far run through the store. */
export async function settle() {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

type Listener = (event: unknown) => void;

/**
 * A browser on a page whose render streams a seed, or not, holding the session hint `hint` (a tag,
 * `0`, a legacy `1`, or none). The test changes the hint as another tab's auth response would
 * (`setHint`) and plays the browser's events: shown again, restored, focused, the hint cookie's
 * change, and another tab's word.
 */
export function stubPage({ hint = "1", seeded }: { hint?: string | null; seeded: boolean }) {
  const page = { seeded };
  const place = { pathname: "/start" };
  const listeners = new Map<string, Listener[]>();
  const posted: unknown[] = [];

  const listen = (target: string) => (type: string, listener: Listener) => {
    const key = `${target}:${type}`;
    listeners.set(key, [...(listeners.get(key) ?? []), listener]);
  };

  const fire = (key: string, event: unknown = {}) =>
    (listeners.get(key) ?? []).forEach((listener) => listener(event));

  const browser = {
    addEventListener: listen("document"),
    cookie: hint === null ? "" : `zoonk-signed-in=${hint}`,
    querySelector: () => (page.seeded ? {} : null),
    visibilityState: "visible",
  };

  vi.stubGlobal("location", place);
  vi.stubGlobal("document", browser);
  vi.stubGlobal("addEventListener", listen("window"));
  vi.stubGlobal("cookieStore", { addEventListener: listen("cookieStore") });

  vi.stubGlobal(
    "BroadcastChannel",
    class {
      readonly name: string;

      constructor(name: string) {
        this.name = name;
      }

      addEventListener(type: string, listener: Listener) {
        listen(`channel:${this.name}`)(type, listener);
      }

      postMessage(data: unknown) {
        posted.push({ channel: this.name, data });
      }
    },
  );

  return {
    /** The hint cookie changed (the browser's own cookie change event). */
    cookieChange: () => fire("cookieStore:change", { changed: [{ name: "zoonk-signed-in" }] }),
    focus: () => fire("window:focus"),
    goTo: (pathname: string) => {
      place.pathname = pathname;
    },
    hide: () => {
      browser.visibilityState = "hidden";
      fire("document:visibilitychange");
    },
    online: () => fire("window:online"),
    page,
    /** What this tab told the others, in order. */
    posted,
    /** The page comes back from the browser's history. */
    restore: () => fire("window:pageshow", { persisted: true }),
    /** The hint as another tab's auth response (or the server's) leaves it. */
    setHint: (value: string | null) => {
      browser.cookie = value === null ? "" : `zoonk-signed-in=${value}`;
    },
    show: () => {
      browser.visibilityState = "visible";
      fire("document:visibilitychange");
    },
    /** Another tab tells this one to compare the hint again. */
    wake: () => fire("channel:zoonk-learner:message", { data: { check: true } }),
  };
}

/** A fresh store: it lives in its module, once per page. */
export async function loadStore() {
  vi.resetModules();
  return import("../learner-store");
}

/** A fresh page: its store, its views and the identity record they share. */
export async function loadPage() {
  const store = await loadStore();
  const identity = await import("../learner-identity");
  const views = await import("../learner-views");

  return { identity, store, views };
}

/** The cover module's port as a test sees it: what the store asked of it, in order. */
export function fakeCover(): IdentityCover & { calls: string[]; retry: () => void } {
  const calls: string[] = [];
  const held: { retry: (() => void) | null } = { retry: null };

  return {
    calls,
    cover: vi.fn(() => calls.push("cover")),
    coverFailed: vi.fn((retry: () => void) => {
      held.retry = retry;
      calls.push("coverFailed");
    }),
    reset: vi.fn((transition) => calls.push(`reset:${JSON.stringify(transition)}`)),
    /** Try again on the failed cover, as the learner presses it. */
    retry: () => held.retry?.(),
    uncover: vi.fn(() => calls.push("uncover")),
  };
}

/** The reset a departure asks of the cover, as `fakeCover` records it. */
export function resetCall({
  contaminated = false,
  from,
  to,
}: {
  contaminated?: boolean;
  from: string | null;
  to: string | null;
}): string {
  return `reset:${JSON.stringify({ contaminated, from, to })}`;
}

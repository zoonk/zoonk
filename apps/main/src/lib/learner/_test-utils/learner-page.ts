import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { vi } from "vitest";
import { type LearnerSummaryResponse } from "../learner-summary-response";

const DAY_MS = 24 * 60 * 60 * 1000;

/** When every learner here signed in: one session each, however often it's read. */
const SIGNED_IN_AT = Date.now() - DAY_MS;

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

/** The summary route's answer for a learner. */
export function answerFor(
  summary: LearnerSummary,
): Extract<LearnerSummaryResponse, { status: "ready" }> {
  return { status: "ready", summary };
}

/** A page's seed for a learner. */
export function seedFor(summary: LearnerSummary) {
  return { status: "ready", summary } as const;
}

/** Summary reads the test answers by hand, in the order it picks. */
export function stubSummaryReads() {
  const reads: PromiseWithResolvers<LearnerSummaryResponse>[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      const read = Promise.withResolvers<LearnerSummaryResponse>();
      reads.push(read);
      return read.promise.then((body) => ({ json: async () => body, ok: true, status: 200 }));
    }),
  );

  return reads;
}

/** Lets every answer given so far run through the store. */
export async function settle() {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

/**
 * A browser on a page whose render streams a seed, or not, holding the session hint `hint` (`1`,
 * `0`, or none); the learner can move to a seeded page later (`page.seeded = true`), and the hint
 * can change as an auth response leaves it (`setHint`).
 */
export function stubPage({ hint = "1", seeded }: { hint?: string | null; seeded: boolean }) {
  const page = { seeded };

  const browser = {
    addEventListener: vi.fn(),
    cookie: hint === null ? "" : `zoonk-signed-in=${hint}`,
    querySelector: () => (page.seeded ? {} : null),
    visibilityState: "visible",
  };

  vi.stubGlobal("document", browser);

  vi.stubGlobal(
    "BroadcastChannel",
    class {
      addEventListener = vi.fn();
      postMessage = vi.fn();
    },
  );

  return {
    page,
    setHint: (value: string | null) => {
      browser.cookie = value === null ? "" : `zoonk-signed-in=${value}`;
    },
  };
}

/** A fresh store: it lives in its module, once per page. */
export async function loadStore() {
  vi.resetModules();
  return import("../learner-store");
}

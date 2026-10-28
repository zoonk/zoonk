import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { vi } from "vitest";
import { type LearnerSummaryResponse } from "../learner-summary-response";

const DAY_MS = 24 * 60 * 60 * 1000;

const SIGNED_IN_AT = Date.now() - DAY_MS;

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
    tier: "free",
    timeZone: null,
    today: null,
  };
}

export function answerFor(
  summary: LearnerSummary,
): Extract<LearnerSummaryResponse, { status: "ready" }> {
  return { status: "ready", summary };
}

export function seedFor(summary: LearnerSummary) {
  return { status: "ready", summary } as const;
}

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

export async function settle() {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

export function stubPage({ seeded }: { seeded: boolean }) {
  const page = { seeded };

  const browser = {
    addEventListener: vi.fn(),
    cookie: "zoonk-signed-in=1",
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

export async function loadStore() {
  vi.resetModules();
  return import("../learner-store");
}

import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LearnerSummaryResponse } from "./learner-summary-response";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long the store waits for a page's seed before reading the summary itself. */
const SEED_WAIT_MS = 10_000;

/** When every learner here signed in: one session each, however often it's read. */
const SIGNED_IN_AT = Date.now() - DAY_MS;

/** One learner's summary as the server read it now. */
function summaryOf(userId: string, activeGoalId: string | null = null): LearnerSummary {
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

/** Summary reads the test answers by hand, in the order it picks. */
function stubSummaryReads() {
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
async function settle() {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

/**
 * A browser holding a session (per its hint) on a page whose render streams a seed, or not; the
 * learner can move to a seeded page later (`page.seeded = true`), and another tab can `announce`
 * whose session it read.
 */
function stubPage({ seeded }: { seeded: boolean }) {
  const page = { seeded };

  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    cookie: "zoonk-signed-in=1",
    querySelector: () => (page.seeded ? {} : null),
    visibilityState: "visible",
  });

  // What another tab says about the session reaches this one through its channel.
  const tabs: ((event: { data: unknown }) => void)[] = [];

  vi.stubGlobal(
    "BroadcastChannel",
    class {
      addEventListener = vi.fn((_type: string, listener: (event: { data: unknown }) => void) => {
        tabs.push(listener);
      });

      postMessage = vi.fn();
    },
  );

  return { announce: (data: unknown) => tabs.forEach((listener) => listener({ data })), page };
}

function heldLearner(store: { getLearnerSummaryState: () => { status: string } }) {
  return store.getLearnerSummaryState();
}

/** A fresh store: it lives in its module, once per page. */
async function loadStore() {
  vi.resetModules();
  return import("./learner-store");
}

describe("learner store identity", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("takes the page's seed over a read sent before the page was asked for", async () => {
    stubPage({ seeded: false });
    const reads = stubSummaryReads();
    const store = await loadStore();

    // The catalog reads the summary with the first learner's cookies...
    store.ensureLearnerSummary();
    expect(reads).toHaveLength(1);

    // ...and Today, asked for after the session changed hands, seeds the second one.
    store.mergeLearnerSummarySeed({ status: "ready", summary: summaryOf("second") });
    reads[0]?.resolve({ status: "ready", summary: summaryOf("first") });
    await settle();

    expect(store.getLearnerSummaryState()).toMatchObject({
      status: "ready",
      summary: { identity: { userId: "second" } },
    });
  });

  it("takes a read sent after waiting for the seed over that seed arriving late", async () => {
    stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const store = await loadStore();

    // The page's seed is on its way: nothing is read until it's late.
    store.ensureLearnerSummary();
    expect(reads).toHaveLength(0);

    vi.advanceTimersByTime(SEED_WAIT_MS);
    expect(reads).toHaveLength(1);

    // The session changed hands before that read; the seed rendered before it arrives last.
    store.mergeLearnerSummarySeed({ status: "ready", summary: summaryOf("first") });
    reads[0]?.resolve({ status: "ready", summary: summaryOf("second") });
    await settle();

    expect(store.getLearnerSummaryState()).toMatchObject({
      status: "ready",
      summary: { identity: { userId: "second" } },
    });
  });

  it("never lets a read sent before a late seed's check win after that check answered", async () => {
    const { page } = stubPage({ seeded: false });
    const reads = stubSummaryReads();
    const store = await loadStore();

    // The catalog's read goes out with the first learner's cookies.
    store.ensureLearnerSummary();

    // The session changes hands; the learner opens Today, whose seed is late.
    page.seeded = true;
    store.ensureLearnerSummary();
    vi.advanceTimersByTime(SEED_WAIT_MS);
    expect(reads).toHaveLength(2);

    // The seed waits for the check; the check answers, then the catalog's read, last.
    store.mergeLearnerSummarySeed({ status: "ready", summary: summaryOf("second") });
    reads[1]?.resolve({ status: "ready", summary: summaryOf("second") });
    await settle();
    reads[0]?.resolve({ status: "ready", summary: summaryOf("first") });
    await settle();

    expect(heldLearner(store)).toMatchObject({
      status: "ready",
      summary: { identity: { userId: "second" } },
    });
  });

  it("asks again instead of taking a late seed when the check failed", async () => {
    stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const store = await loadStore();

    store.ensureLearnerSummary();
    vi.advanceTimersByTime(SEED_WAIT_MS);
    reads[0]?.reject(new Error("offline"));
    await settle();
    expect(heldLearner(store)).toStrictEqual({ status: "failed" });

    // The seed rendered before the session changed hands arrives: it only starts another check.
    store.mergeLearnerSummarySeed({ status: "ready", summary: summaryOf("first") });
    expect(heldLearner(store)).toStrictEqual({ status: "failed" });
    expect(reads).toHaveLength(2);

    reads[1]?.resolve({ status: "ready", summary: summaryOf("second") });
    await settle();

    expect(heldLearner(store)).toMatchObject({
      status: "ready",
      summary: { identity: { userId: "second" } },
    });
  });

  it("reads again after a goal switch whose answer a session check made stale", async () => {
    const { announce } = stubPage({ seeded: false });
    const reads = stubSummaryReads();
    const store = await loadStore();

    store.ensureLearnerSummary();
    reads[0]?.resolve({ status: "ready", summary: summaryOf("first", "old-goal") });
    await settle();

    // The switch goes out; another tab's late word starts a check, answered before it saves.
    const generation = store.getLearnerGeneration();
    announce({ identity: summaryOf("someone-else").identity });
    reads[1]?.resolve({ status: "ready", summary: summaryOf("first", "old-goal") });
    await settle();

    // The switch's own answer is dropped, and the summary is read again after it.
    store.mergeLearnerSummary({ generation, summary: summaryOf("first", "new-goal") });
    expect(reads).toHaveLength(3);
    reads[2]?.resolve({ status: "ready", summary: summaryOf("first", "new-goal") });
    await settle();

    expect(heldLearner(store)).toMatchObject({
      status: "ready",
      summary: { activeGoalId: "new-goal" },
    });
  });
});

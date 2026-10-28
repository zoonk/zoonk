import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerFor,
  loadStore,
  seedFor,
  settle,
  stubPage,
  stubSummaryReads,
  summaryOf,
} from "./_test-utils/learner-page";

const SEED_WAIT_MS = 10_000;

function heldLearner(store: { getLearnerSummaryState: () => { status: string } }) {
  return store.getLearnerSummaryState();
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

    store.ensureLearnerSummary();
    expect(reads).toHaveLength(1);

    store.mergeLearnerSummarySeed(seedFor(summaryOf("second")));
    reads[0]?.resolve(answerFor(summaryOf("first")));
    await settle();

    expect(store.getLearnerSummaryState()).toMatchObject({
      status: "ready",
      summary: { identity: { userId: "second" } },
    });
  });

  it("holds the learner its read finds, not a late seed rendered for another", async () => {
    stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const store = await loadStore();

    store.ensureLearnerSummary();
    expect(reads).toHaveLength(0);

    vi.advanceTimersByTime(SEED_WAIT_MS);
    expect(reads).toHaveLength(1);

    store.mergeLearnerSummarySeed(seedFor(summaryOf("first")));
    reads[0]?.resolve(answerFor(summaryOf("second")));
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

    store.ensureLearnerSummary();

    page.seeded = true;
    store.ensureLearnerSummary();
    vi.advanceTimersByTime(SEED_WAIT_MS);
    expect(reads).toHaveLength(2);

    store.mergeLearnerSummarySeed(seedFor(summaryOf("second")));
    reads[1]?.resolve(answerFor(summaryOf("second")));
    await settle();
    reads[0]?.resolve(answerFor(summaryOf("first")));
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

    store.mergeLearnerSummarySeed(seedFor(summaryOf("first")));
    expect(heldLearner(store)).toStrictEqual({ status: "failed" });
    expect(reads).toHaveLength(2);

    reads[1]?.resolve(answerFor(summaryOf("first")));
    await settle();

    expect(heldLearner(store)).toMatchObject({
      status: "ready",
      summary: { identity: { userId: "first" } },
    });
  });

  it("reads again after a goal switch whose answer a session check made stale", async () => {
    stubPage({ seeded: false });
    const reads = stubSummaryReads();
    const store = await loadStore();

    store.ensureLearnerSummary();
    reads[0]?.resolve(answerFor(summaryOf("first", "old-goal")));
    await settle();

    const generation = store.getLearnerGeneration();
    store.mergeLearnerSummarySeed({ status: "visitor" });
    reads[1]?.resolve(answerFor(summaryOf("first", "old-goal")));
    await settle();

    store.mergeLearnerSummary({ generation, summary: summaryOf("first", "new-goal") });
    expect(reads).toHaveLength(3);
    reads[2]?.resolve(answerFor(summaryOf("first", "new-goal")));
    await settle();

    expect(heldLearner(store)).toMatchObject({
      status: "ready",
      summary: { activeGoalId: "new-goal" },
    });
  });
});

const MINUTE_MS = 60 * 1000;

const SERVER_READ_AT = Date.UTC(2026, 9, 14, 23, 50);

function summaryReadAt({ nextChangeAt, readAt }: { nextChangeAt: number; readAt: number }) {
  return { ...summaryOf("first"), nextChangeAt, readAt };
}

async function showLearner({
  deviceAhead,
  nextChangeAt,
}: {
  deviceAhead: number;
  nextChangeAt: number;
}) {
  vi.setSystemTime(SERVER_READ_AT + deviceAhead);
  stubPage({ seeded: false });
  const reads = stubSummaryReads();
  const store = await loadStore();

  store.subscribeToLearnerSummary(vi.fn());
  store.ensureLearnerSummary();

  reads[0]?.resolve(answerFor(summaryReadAt({ nextChangeAt, readAt: SERVER_READ_AT })));

  await settle();

  return { reads, store };
}

describe("learner store timing", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    { clock: "ahead", deviceAhead: 15 * MINUTE_MS },
    { clock: "behind", deviceAhead: -15 * MINUTE_MS },
  ])(
    "reads the summary again at its next change by the server's clock, a device's $clock",
    async ({ deviceAhead }) => {
      const { reads, store } = await showLearner({
        deviceAhead,
        nextChangeAt: SERVER_READ_AT + 10 * MINUTE_MS,
      });

      store.ensureLearnerSummary();
      vi.advanceTimersByTime(10 * MINUTE_MS - 1);
      expect(reads).toHaveLength(1);

      vi.advanceTimersByTime(1);
      expect(reads).toHaveLength(2);
    },
  );

  it("keeps the next change's time when a page hands back the same summary", async () => {
    const nextChangeAt = SERVER_READ_AT + 2 * MINUTE_MS;
    const { reads, store } = await showLearner({ deviceAhead: 0, nextChangeAt });

    vi.advanceTimersByTime(90 * 1000);

    store.mergeLearnerSummarySeed(seedFor(summaryReadAt({ nextChangeAt, readAt: SERVER_READ_AT })));

    vi.advanceTimersByTime(30 * 1000 - 1);
    expect(reads).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(reads).toHaveLength(2);
  });

  it("asks again at most once a minute when the server's answer is already due", async () => {
    const { reads } = await showLearner({ deviceAhead: 0, nextChangeAt: SERVER_READ_AT - 1 });

    vi.advanceTimersByTime(MINUTE_MS - 1);
    expect(reads).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(reads).toHaveLength(2);

    reads[1]?.resolve(
      answerFor(
        summaryReadAt({ nextChangeAt: SERVER_READ_AT, readAt: SERVER_READ_AT + MINUTE_MS }),
      ),
    );

    await settle();

    vi.advanceTimersByTime(MINUTE_MS - 1);
    expect(reads).toHaveLength(2);

    vi.advanceTimersByTime(1);
    expect(reads).toHaveLength(3);
  });
});

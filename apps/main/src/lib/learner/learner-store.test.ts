import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerFor,
  fakeCover,
  loadPage,
  loadStore,
  resetCall,
  seedFor,
  settle,
  stubPage,
  stubSummaryReads,
  summaryOf,
  tagOf,
} from "./_test-utils/learner-page";

/** How long the store waits for a page's seed before reading the summary itself. */
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

    // The catalog reads the summary with the first learner's cookies...
    store.ensureLearnerSummary();
    expect(reads).toHaveLength(1);

    // ...and Today, asked for after the session changed hands, seeds the second one.
    store.mergeLearnerSummarySeed(seedFor(summaryOf("second")));
    reads[0]?.resolve(answerFor(summaryOf("first")));
    await settle();

    expect(store.getLearnerSummaryState()).toMatchObject({
      status: "ready",
      summary: { identity: { userId: "second" } },
    });
  });

  it("leaves, covered, when a late seed was rendered for another learner than its read finds", async () => {
    stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { identity, store } = await loadPage();
    const cover = fakeCover();
    identity.registerIdentityCover({ cover, handoff: { seen: undefined, witnesses: [] } });

    // The page's seed is on its way: nothing is read until it's late.
    store.ensureLearnerSummary();
    expect(reads).toHaveLength(0);

    vi.advanceTimersByTime(SEED_WAIT_MS);
    expect(reads).toHaveLength(1);

    // The session changed hands before that read; the page, rendered before it, drew the first
    // learner, whose seed arrives last.
    store.mergeLearnerSummarySeed(seedFor(summaryOf("first")));
    reads[0]?.resolve(answerFor(summaryOf("second")));
    await settle();

    expect(cover.calls.at(-1)).toBe(
      resetCall({ contaminated: true, from: tagOf("first"), to: null }),
    );

    expect(store.getHeldLearnerId()).toBeUndefined();
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

    // The seed arrives: it only starts another check, which finds the learner it was drawn for.
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

    // The switch goes out; a page the router kept for nobody starts a check, answered before it
    // saves.
    const generation = store.getLearnerGeneration();
    store.mergeLearnerSummarySeed({ status: "visitor" });
    reads[1]?.resolve(answerFor(summaryOf("first", "old-goal")));
    await settle();

    // The switch's own answer is dropped, and the summary is read again after it.
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

describe("the held learner", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("is unknown until a read answers, then names the learner", async () => {
    stubPage({ seeded: false });
    const reads = stubSummaryReads();
    const store = await loadStore();

    expect(store.getHeldLearnerId()).toBeUndefined();

    store.ensureLearnerSummary();
    reads[0]?.resolve(answerFor(summaryOf("first")));
    await settle();

    expect(store.getHeldLearnerId()).toBe("first");
  });

  it("is nobody only once the server said so, never from the browser's own guess", async () => {
    const { setHint } = stubPage({ seeded: false });
    const reads = stubSummaryReads();
    const store = await loadStore();

    // The hint says no session: the browser's own guess that nobody is signed in.
    setHint("0");
    store.ensureLearnerSummary();
    expect(store.getHeldLearnerId()).toBeUndefined();

    // A hint left from a session makes the browser ask: the server says nobody holds one.
    setHint("1");
    store.ensureLearnerSummary();
    reads[0]?.resolve({ readAt: Date.now(), status: "visitor" });
    await settle();

    expect(store.getHeldLearnerId()).toBeNull();
  });
});

const MINUTE_MS = 60 * 1000;

/** When the server read the summaries below, by its own clock. */
const SERVER_READ_AT = Date.UTC(2026, 9, 14, 23, 50);

/** The learner's summary as the server read it at `readAt`, changing on its own at `nextChangeAt`. */
function summaryReadAt({ nextChangeAt, readAt }: { nextChangeAt: number; readAt: number }) {
  return { ...summaryOf("first"), nextChangeAt, readAt };
}

/** A tab showing the learner, whose summary the server read at `SERVER_READ_AT`. */
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
      // Midnight is ten minutes away for the server; the device's clock is a quarter-hour off.
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

    // The learner comes back to a page the router kept, whose seed is that same read.
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

    // The next answer is still due: the minute starts again from it.
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

describe("the summary after this tab's writes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reads again once a write committed a newer revision than the summary holds", async () => {
    stubPage({ seeded: false });
    const reads = stubSummaryReads();
    const store = await loadStore();

    store.ensureLearnerSummary();
    reads[0]?.resolve(answerFor(summaryOf("first")));
    await settle();

    store.catchUpLearnerSummary({
      generation: store.getLearnerGeneration(),
      revision: "2",
      userId: "first",
    });

    expect(reads).toHaveLength(2);
  });

  it("reads once more when a read already on its way answers behind the write", async () => {
    stubPage({ seeded: false });
    const reads = stubSummaryReads();
    const store = await loadStore();

    store.ensureLearnerSummary();
    reads[0]?.resolve(answerFor(summaryOf("first")));
    await settle();
    const generation = store.getLearnerGeneration();

    // A read for revision 2 is out when a write commits revision 3.
    store.catchUpLearnerSummary({ generation, revision: "2", userId: "first" });
    store.catchUpLearnerSummary({ generation, revision: "3", userId: "first" });
    expect(reads).toHaveLength(2);

    reads[1]?.resolve(answerFor({ ...summaryOf("first"), revision: "2" }));
    await settle();

    expect(reads).toHaveLength(3);
  });

  it("reads nothing for a revision it holds, another learner's, or an older identity's", async () => {
    stubPage({ seeded: false });
    const reads = stubSummaryReads();
    const store = await loadStore();

    store.ensureLearnerSummary();
    reads[0]?.resolve(answerFor(summaryOf("first")));
    await settle();
    const generation = store.getLearnerGeneration();

    store.catchUpLearnerSummary({ generation, revision: "1", userId: "first" });
    store.catchUpLearnerSummary({ generation, revision: "3", userId: "other" });
    store.catchUpLearnerSummary({ generation: generation - 1, revision: "3", userId: "first" });

    expect(reads).toHaveLength(1);
  });
});

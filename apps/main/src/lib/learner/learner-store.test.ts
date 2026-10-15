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
 * learner can move to a seeded page later (`page.seeded = true`), the tab can mark a session it
 * made (`markSession`), and another tab can `announce` whose session it read.
 */
function stubPage({ seeded }: { seeded: boolean }) {
  const page = { seeded };
  const place = { pathname: "/start" };

  vi.stubGlobal("location", place);

  const browser = {
    addEventListener: vi.fn(),
    cookie: "zoonk-signed-in=1",
    querySelector: () => (page.seeded ? {} : null),
    visibilityState: "visible",
  };

  vi.stubGlobal("document", browser);

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

  return {
    announce: (data: unknown) => tabs.forEach((listener) => listener({ data })),
    goTo: (pathname: string) => {
      place.pathname = pathname;
    },
    markSession: () => {
      browser.cookie = "zoonk-signed-in=1";
    },
    page,
  };
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
    reads[0]?.resolve({ status: "ready", summary: summaryOf("first") });
    await settle();

    expect(store.getHeldLearnerId()).toBe("first");
  });

  it("is nobody only once the server said so, never from the browser's own guess", async () => {
    const { announce } = stubPage({ seeded: false });
    const reads = stubSummaryReads();
    const store = await loadStore();

    store.ensureLearnerSummary();
    reads[0]?.resolve({ status: "ready", summary: summaryOf("first") });
    await settle();

    // Another tab signs out: the check that follows says nobody holds the session.
    announce({ identity: null });
    reads[1]?.resolve({ readAt: Date.now(), status: "visitor" });
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

  reads[0]?.resolve({
    status: "ready",
    summary: summaryReadAt({ nextChangeAt, readAt: SERVER_READ_AT }),
  });

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

    store.mergeLearnerSummarySeed({
      status: "ready",
      summary: summaryReadAt({ nextChangeAt, readAt: SERVER_READ_AT }),
    });

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
    reads[1]?.resolve({
      status: "ready",
      summary: summaryReadAt({ nextChangeAt: SERVER_READ_AT, readAt: SERVER_READ_AT + MINUTE_MS }),
    });

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
    reads[0]?.resolve({ status: "ready", summary: summaryOf("first") });
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
    reads[0]?.resolve({ status: "ready", summary: summaryOf("first") });
    await settle();
    const generation = store.getLearnerGeneration();

    // A read for revision 2 is out when a write commits revision 3.
    store.catchUpLearnerSummary({ generation, revision: "2", userId: "first" });
    store.catchUpLearnerSummary({ generation, revision: "3", userId: "first" });
    expect(reads).toHaveLength(2);

    reads[1]?.resolve({ status: "ready", summary: { ...summaryOf("first"), revision: "2" } });
    await settle();

    expect(reads).toHaveLength(3);
  });

  it("reads nothing for a revision it holds, another learner's, or an older identity's", async () => {
    stubPage({ seeded: false });
    const reads = stubSummaryReads();
    const store = await loadStore();

    store.ensureLearnerSummary();
    reads[0]?.resolve({ status: "ready", summary: summaryOf("first") });
    await settle();
    const generation = store.getLearnerGeneration();

    store.catchUpLearnerSummary({ generation, revision: "1", userId: "first" });
    store.catchUpLearnerSummary({ generation, revision: "3", userId: "other" });
    store.catchUpLearnerSummary({ generation: generation - 1, revision: "3", userId: "first" });

    expect(reads).toHaveLength(1);
  });
});

/**
 * A fresh store whose pages report each time they read themselves again (`redraw`), with the
 * pages' own module (`pages`) as the store loaded it.
 */
async function watchRedraws() {
  const store = await loadStore();
  const pages = await import("./learner-pages");
  const redraw = vi.fn();
  pages.onLearnerIdentityChange(redraw);
  return { pages, redraw, store };
}

describe("pages drawn for the session before", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("are read again when another tab signs the learner out and back in", async () => {
    const { announce } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { redraw, store } = await watchRedraws();
    const learner = summaryOf("first");

    store.ensureLearnerSummary();
    store.mergeLearnerSummarySeed({ status: "ready", summary: learner });

    // Another tab signs out: the Plan showed the learner.
    announce({ identity: null });
    reads[0]?.resolve({ readAt: Date.now(), status: "visitor" });
    await settle();
    expect(redraw).toHaveBeenCalledOnce();

    // ...and signs back in: the Plan drawn since asks them to log in.
    announce({ identity: learner.identity });
    reads[1]?.resolve({ status: "ready", summary: learner });
    await settle();

    expect(redraw).toHaveBeenCalledTimes(2);
  });

  it("are read again when a page drawn signed out sees another tab sign in", async () => {
    const { announce } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { redraw, store } = await watchRedraws();
    const learner = summaryOf("first");

    store.ensureLearnerSummary();
    store.mergeLearnerSummarySeed({ status: "visitor" });

    announce({ identity: learner.identity });
    reads[0]?.resolve({ status: "ready", summary: learner });
    await settle();

    expect(redraw).toHaveBeenCalledOnce();
    expect(store.getHeldLearnerId()).toBe("first");
  });

  it("are read again when another tab signs in before the page's own seed arrives", async () => {
    const { announce } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { redraw, store } = await watchRedraws();
    const learner = summaryOf("first");

    // The page is on its way, drawn signed out, when another tab signs in.
    store.ensureLearnerSummary();
    announce({ identity: learner.identity });
    reads[0]?.resolve({ status: "ready", summary: learner });
    await settle();
    expect(redraw).not.toHaveBeenCalled();

    store.mergeLearnerSummarySeed({ status: "visitor" });
    reads[1]?.resolve({ status: "ready", summary: learner });
    await settle();

    expect(redraw).toHaveBeenCalledOnce();
  });

  it("are read again once a check that failed is asked again", async () => {
    const { announce } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { redraw, store } = await watchRedraws();
    const learner = summaryOf("first");

    store.ensureLearnerSummary();
    store.mergeLearnerSummarySeed({ status: "visitor" });

    announce({ identity: learner.identity });
    reads[0]?.reject(new Error("offline"));
    await settle();

    // The next page's seed (drawn signed out, too) asks again.
    store.mergeLearnerSummarySeed({ status: "visitor" });
    reads[1]?.resolve({ status: "ready", summary: learner });
    await settle();

    expect(redraw).toHaveBeenCalledOnce();
  });

  it("aren't read again for the guest this tab made, whatever late seeds arrive", async () => {
    const { announce, markSession } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { pages, redraw, store } = await watchRedraws();
    const guest = summaryOf("guest");

    // The goal's page was drawn for a visitor, who starts a goal: the tab makes them a guest. Seeds
    // of renders begun before arrive late (a visitor's, a previous learner's), and another tab opens
    // as the same guest.
    store.ensureLearnerSummary();
    store.mergeLearnerSummarySeed({ status: "visitor" });
    pages.adoptNewSession("guest");
    markSession();
    store.ensureLearnerSummary();
    store.mergeLearnerSummarySeed({ status: "visitor" });
    announce({ identity: guest.identity });
    reads[0]?.resolve({ status: "ready", summary: guest });
    await settle();
    store.mergeLearnerSummarySeed({ status: "visitor" });
    store.mergeLearnerSummarySeed({ status: "ready", summary: summaryOf("previous") });
    reads[1]?.resolve({ status: "ready", summary: guest });
    await settle();

    expect(store.getHeldLearnerId()).toBe("guest");
    expect(redraw).not.toHaveBeenCalled();
  });

  it("aren't read again for this tab's guest when a page's late seed arrives after its read", async () => {
    const { markSession } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { pages, redraw, store } = await watchRedraws();
    const guest = summaryOf("guest");

    // The store knew a visitor; /start's own seed is still on its way when the guest is made.
    store.ensureLearnerSummary();
    store.mergeLearnerSummarySeed({ status: "visitor" });
    pages.adoptNewSession("guest");
    markSession();
    store.ensureLearnerSummary();
    reads[0]?.resolve({ status: "ready", summary: guest });
    await settle();

    store.mergeLearnerSummarySeed({ status: "visitor" });
    reads[1]?.resolve({ status: "ready", summary: guest });
    await settle();

    expect(redraw).not.toHaveBeenCalled();
  });

  it("aren't read again for this tab's guest after a late visitor announcement", async () => {
    const { announce, markSession } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { pages, redraw, store } = await watchRedraws();

    store.ensureLearnerSummary();
    store.mergeLearnerSummarySeed({ status: "visitor" });
    pages.adoptNewSession("guest");
    markSession();
    store.ensureLearnerSummary();

    // Another tab read nobody before the guest existed; its word and a late seed arrive after.
    announce({ identity: null });
    store.mergeLearnerSummarySeed({ status: "visitor" });
    reads[0]?.resolve({ status: "ready", summary: summaryOf("guest") });
    await settle();

    expect(redraw).not.toHaveBeenCalled();
  });

  it("are read again for a learner another tab signed in while this tab's guest was on its way", async () => {
    const { announce } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { pages, redraw, store } = await watchRedraws();
    const learner = summaryOf("first");

    store.ensureLearnerSummary();
    store.mergeLearnerSummarySeed({ status: "visitor" });

    // Another tab signs in while this one waits for its guest, whose answer comes in between.
    announce({ identity: learner.identity });
    pages.adoptNewSession("guest");
    reads[0]?.resolve({ status: "ready", summary: learner });
    await settle();

    expect(redraw).toHaveBeenCalledOnce();
  });

  it("are read again for a page drawn signed out after this tab's guest", async () => {
    const { announce, markSession } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { pages, redraw, store } = await watchRedraws();
    const learner = summaryOf("first");

    store.ensureLearnerSummary();
    store.mergeLearnerSummarySeed({ status: "visitor" });
    pages.adoptNewSession("guest");
    markSession();
    store.ensureLearnerSummary();
    reads[0]?.reject(new Error("offline"));
    await settle();

    // Another tab signs out, the learner opens the Plan here (drawn signed out), then signs in.
    announce({ identity: null });
    store.mergeLearnerSummarySeed({ status: "visitor" });
    announce({ identity: learner.identity });
    reads[1]?.resolve({ status: "ready", summary: learner });
    await settle();

    expect(redraw).toHaveBeenCalledOnce();
  });

  it("are read again for a page drawn signed out before this tab's guest, opened again", async () => {
    const { goTo, markSession } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { pages, redraw, store } = await watchRedraws();
    const guest = summaryOf("guest");

    // The Plan was drawn signed out; the learner starts a goal on /start, then goes back to the Plan.
    goTo("/plan");
    store.ensureLearnerSummary();
    store.mergeLearnerSummarySeed({ status: "visitor" });
    goTo("/start");
    store.mergeLearnerSummarySeed({ status: "visitor" });
    pages.adoptNewSession("guest");
    markSession();
    store.ensureLearnerSummary();
    reads[0]?.resolve({ status: "ready", summary: guest });
    await settle();
    expect(redraw).not.toHaveBeenCalled();

    goTo("/plan");
    store.mergeLearnerSummarySeed({ status: "visitor" });
    reads[1]?.resolve({ status: "ready", summary: guest });
    await settle();

    expect(redraw).toHaveBeenCalledOnce();
  });

  it("are read again for another learner's page that arrives after they signed out elsewhere", async () => {
    const { announce, goTo, markSession } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { pages, redraw, store } = await watchRedraws();
    const learner = summaryOf("first");

    store.ensureLearnerSummary();
    store.mergeLearnerSummarySeed({ status: "visitor" });
    pages.adoptNewSession("guest");
    markSession();
    store.ensureLearnerSummary();
    reads[0]?.reject(new Error("offline"));
    await settle();

    // Another tab signs in as someone else; the check fails. This tab opens their Plan, and the
    // other tab signs out before the Plan's seed arrives: the check now finds nobody.
    announce({ identity: learner.identity });
    reads[1]?.reject(new Error("offline"));
    await settle();
    goTo("/plan");
    store.mergeLearnerSummarySeed({ status: "ready", summary: learner });
    reads[2]?.resolve({ readAt: Date.now(), status: "visitor" });
    await settle();

    expect(redraw).toHaveBeenCalledOnce();
  });

  it("aren't read again when another tab opens as the same learner while the page loads", async () => {
    const { announce } = stubPage({ seeded: true });
    const reads = stubSummaryReads();
    const { redraw, store } = await watchRedraws();
    const learner = summaryOf("first");

    store.ensureLearnerSummary();
    announce({ identity: learner.identity });
    reads[0]?.resolve({ status: "ready", summary: learner });
    await settle();
    store.mergeLearnerSummarySeed({ status: "ready", summary: learner });
    await settle();

    expect(redraw).not.toHaveBeenCalled();
  });
});

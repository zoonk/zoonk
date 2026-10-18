import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubPage } from "./_test-utils/learner-page";
import { type LearnerSummaryResponse } from "./learner-summary-response";
import { type LearnerViewCopy, type LearnerViewResponse } from "./learner-view-copies";
import { stringifyLearnerView } from "./view-json";

const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNED_IN_AT = Date.now() - DAY_MS;

function summaryOf(userId: string, revision = "7", localDate = "2026-10-15"): LearnerSummary {
  const now = Date.now();

  return {
    account: { email: `${userId}@zoonk.test`, image: null, name: userId },
    activeGoalId: "goal",
    analytics: { disabled: false, goal: null, plan: "free", username: null },
    buddy: {
      beltColor: "white",
      energy: null,
      glasses: "round",
      kind: "zu",
      name: null,
      studiedToday: false,
    },
    day: { goalId: "goal", localDate },
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
    revision,
    tier: "free",
    timeZone: "UTC",
    today: null,
  };
}

function copyOf(
  revision: string,
  userId = "learner",
  localDate = "2026-10-15",
): LearnerViewCopy<string> {
  return {
    day: `goal:${localDate}`,
    readAt: Date.now(),
    revision,
    userId,
    view: `today at ${revision}`,
  };
}

/**
 * The view reads Today makes and the summary reads the frame makes, answered by the test in the
 * order it picks.
 */
function stubViewReads() {
  const reads: PromiseWithResolvers<LearnerViewResponse<string>>[] = [];
  const summaryReads: PromiseWithResolvers<LearnerSummaryResponse>[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/api/learner/summary") {
        const read = Promise.withResolvers<LearnerSummaryResponse>();
        summaryReads.push(read);
        return read.promise.then((body) => ({ json: async () => body, ok: true, status: 200 }));
      }

      if (!url.startsWith("/api/learner/views/")) {
        throw new Error(`Unexpected read of ${url}`);
      }

      const read = Promise.withResolvers<LearnerViewResponse<string>>();
      reads.push(read);

      return read.promise.then((body) => ({
        ok: true,
        status: 200,
        text: async () => stringifyLearnerView(body),
      }));
    }),
  );

  return Object.assign(reads, { summaryReads });
}

/** A plan change's answer saved it only when it says it was applied. */
function isApplied(result: { status: string }): boolean {
  return result.status === "applied";
}

async function settle() {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

/**
 * A tab showing Today for `userId` at `revision`, as its screen does: it shows the newest copy the
 * store holds, and checks whether it's old whenever the store says something changed.
 */
async function showToday({ revision, userId }: { revision: string; userId: string }) {
  vi.resetModules();
  stubPage({ seeded: true });
  const reads = stubViewReads();
  const store = await import("./learner-store");
  const views = await import("./learner-views");

  store.mergeLearnerSummarySeed({ status: "ready", summary: summaryOf(userId, revision) });

  const page = copyOf(revision, userId);
  views.holdLearnerView("today", page);

  const shown = () => views.getHeldLearnerView("today") ?? page;

  const reconcile = (show: boolean) =>
    views.reconcileLearnerView({ kind: "today", onResponse: vi.fn(), show, shown: shown() });

  views.subscribeToLearnerViews(() => reconcile(false));

  return { reads, reconcile, shown, store, views };
}

describe("learner views", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("catches the frame's summary up to a write even when a view already heard of it", async () => {
    const { reads, store, views } = await showToday({ revision: "7", userId: "learner" });

    // Today's own read brought revision 8 before the write's answer did; the summary is still at 7.
    views.holdLearnerView("today", copyOf("8"));

    views.noteLearnerRevision({
      generation: store.getLearnerGeneration(),
      revision: "8",
      userId: "learner",
    });

    expect(reads.summaryReads).toHaveLength(1);
  });

  it("reads Today once more for a revision the tab learned while its read was out", async () => {
    const { reads, shown, store, views } = await showToday({ revision: "7", userId: "learner" });
    const generation = store.getLearnerGeneration();

    views.noteLearnerRevision({ generation, revision: "8", userId: "learner" });
    expect(reads).toHaveLength(1);

    // Revision 9 commits while the read sent for 8 is out: that read may not hold it.
    views.noteLearnerRevision({ generation, revision: "9", userId: "learner" });
    expect(reads).toHaveLength(1);

    reads[0]?.resolve({ copy: copyOf("8"), status: "ready" });
    await settle();

    expect(shown().revision).toBe("8");
    expect(reads).toHaveLength(2);

    reads[1]?.resolve({ copy: copyOf("9"), status: "ready" });
    await settle();

    expect(shown().revision).toBe("9");
    expect(reads).toHaveLength(2);
  });

  it("never reads Today again for what the copy that just landed shows, whatever copy the screen drew last", async () => {
    const { reads, store, views } = await showToday({ revision: "7", userId: "learner" });

    // A screen that hasn't drawn again since: its listener still judges the copy it drew.
    const drawn = copyOf("7");

    views.subscribeToLearnerViews(() =>
      views.reconcileLearnerView({
        drawsHeld: true,
        kind: "today",
        onResponse: vi.fn(),
        show: false,
        shown: drawn,
      }),
    );

    // The device's zone moved the learner to the next day: the follow's write notes revision 8.
    views.noteLearnerRevision({
      generation: store.getLearnerGeneration(),
      revision: "8",
      userId: "learner",
    });

    expect(reads).toHaveLength(1);

    // The frame's summary lands first and names the new day while Today's read is out.
    reads.summaryReads[0]?.resolve({
      status: "ready",
      summary: summaryOf("learner", "8", "2026-10-16"),
    });

    await settle();

    // Today's read brings the new day: nothing is left to read for.
    reads[0]?.resolve({ copy: copyOf("8", "learner", "2026-10-16"), status: "ready" });
    await settle();

    expect(reads).toHaveLength(1);
  });

  it("never lets a newer copy a page showing another state doesn't draw stand in for it", async () => {
    const { views } = await showToday({ revision: "7", userId: "learner" });
    const onResponse = vi.fn();

    // A newer copy of Today is held, but this page shows another state (a paused goal) drawn at 6:
    // it's out of date, so it's told, rather than judged by a copy it doesn't show.
    views.holdLearnerView("today", copyOf("8"));

    views.reconcileLearnerView({
      kind: "today",
      onResponse,
      show: true,
      shown: { day: null, readAt: Date.now() - DAY_MS, revision: "6", userId: "learner" },
    });

    expect(onResponse).toHaveBeenCalledWith({
      copy: expect.objectContaining({ revision: "8" }),
      status: "ready",
    });
  });

  it("answers a page showing another state that joined a read already out", async () => {
    const { reads, store, views } = await showToday({ revision: "7", userId: "learner" });
    const onResponse = vi.fn();

    views.noteLearnerRevision({
      generation: store.getLearnerGeneration(),
      revision: "8",
      userId: "learner",
    });

    // A render of another state (a paused goal) from before the write mounts while the read is out.
    views.reconcileLearnerView({
      kind: "today",
      onResponse,
      show: true,
      shown: { day: null, revision: "7", userId: "learner" },
    });

    expect(reads).toHaveLength(1);

    reads[0]?.resolve({ copy: copyOf("8"), status: "ready" });
    await settle();

    expect(onResponse).toHaveBeenCalledWith({
      copy: expect.objectContaining({ revision: "8" }),
      status: "ready",
    });
  });

  it("answers a subscribed page showing another state once for the read it joined", async () => {
    const { reads, store, views } = await showToday({ revision: "7", userId: "learner" });
    const onResponse = vi.fn();
    const stale = { day: null, revision: "7", userId: "learner" };

    // A page showing another state (a paused goal) checks itself whenever the store changes.
    views.subscribeToLearnerViews(() =>
      views.reconcileLearnerView({ kind: "today", onResponse, show: false, shown: stale }),
    );

    views.noteLearnerRevision({
      generation: store.getLearnerGeneration(),
      revision: "8",
      userId: "learner",
    });

    reads[0]?.resolve({ copy: copyOf("8"), status: "ready" });
    await settle();

    expect(onResponse).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ status: "ready" }),
    );
  });

  it("answers a page showing another state, once, when a newer copy was already read", async () => {
    const { reads, store, views } = await showToday({ revision: "7", userId: "learner" });

    views.noteLearnerRevision({
      generation: store.getLearnerGeneration(),
      revision: "8",
      userId: "learner",
    });

    reads[0]?.resolve({ copy: copyOf("8"), status: "ready" });
    await settle();

    // A delayed render of another state, older than the copy read, mounts after that read.
    const onResponse = vi.fn();
    const stale = { day: null, revision: "6", userId: "learner" };

    views.reconcileLearnerView({ kind: "today", onResponse, show: true, shown: stale });
    views.reconcileLearnerView({ kind: "today", onResponse, show: false, shown: stale });

    expect(onResponse).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ status: "ready" }),
    );

    expect(reads).toHaveLength(1);
  });

  it("settles a refresh asked while an older read is out only once a read sent after it lands", async () => {
    const { reads, shown, store, views } = await showToday({ revision: "7", userId: "learner" });

    views.noteLearnerRevision({
      generation: store.getLearnerGeneration(),
      revision: "8",
      userId: "learner",
    });

    let landed: string | null = null;

    void views.refreshLearnerView({ kind: "today", onResponse: vi.fn() }).then((result) => {
      landed = result;
    });

    // The read out was sent before the ask, so it may not hold what the ask is about.
    reads[0]?.resolve({ copy: copyOf("8"), status: "ready" });
    await settle();

    expect(landed).toBeNull();
    expect(reads).toHaveLength(2);

    reads[1]?.resolve({ copy: copyOf("9"), status: "ready" });
    await settle();

    expect(landed).toBe("shown");
    expect(shown().revision).toBe("9");
    expect(reads).toHaveLength(2);
  });

  it("settles a refresh with what its read came to: failed, or another state for the page", async () => {
    const { reads, views } = await showToday({ revision: "7", userId: "learner" });
    const failed = views.refreshLearnerView({ kind: "today", onResponse: vi.fn() });

    reads[0]?.reject(new Error("offline"));
    await expect(failed).resolves.toBe("failed");

    const elsewhere = views.refreshLearnerView({ kind: "today", onResponse: vi.fn() });

    reads[1]?.resolve({ revision: "8", state: "paused", status: "elsewhere" });
    await expect(elsewhere).resolves.toBe("elsewhere");
  });

  it("reads again on the next show after a read that failed, never in a loop", async () => {
    const { reads, reconcile, store, views } = await showToday({
      revision: "7",
      userId: "learner",
    });

    views.noteLearnerRevision({
      generation: store.getLearnerGeneration(),
      revision: "8",
      userId: "learner",
    });

    reads[0]?.reject(new Error("offline"));
    await settle();
    expect(reads).toHaveLength(1);

    reconcile(true);
    expect(reads).toHaveLength(2);
  });

  it("never keeps or shows a copy rendered for another learner than the one the browser holds", async () => {
    const { views } = await showToday({ revision: "7", userId: "second" });

    views.holdLearnerView("today", copyOf("12", "first"));

    expect(views.getHeldLearnerView("today")).toMatchObject({ userId: "second" });
    expect(views.isForHeldLearner("first")).toBe(false);
  });

  it("drops a read's answer for someone else, and reads nothing for a copy of someone else", async () => {
    const { reads, store, views } = await showToday({ revision: "7", userId: "learner" });

    views.noteLearnerRevision({
      generation: store.getLearnerGeneration(),
      revision: "8",
      userId: "learner",
    });

    // The session changed hands in another tab while the read was out.
    reads[0]?.resolve({ copy: copyOf("30", "someone-else"), status: "ready" });
    await settle();

    expect(views.getHeldLearnerView("today")).toMatchObject({ revision: "7", userId: "learner" });

    views.reconcileLearnerView({
      kind: "today",
      onResponse: vi.fn(),
      show: true,
      shown: copyOf("1", "someone-else"),
    });

    expect(reads).toHaveLength(1);
  });

  it("reads Today again once a write with no revision saved, and never for one that didn't", async () => {
    const { reads, views } = await showToday({ revision: "7", userId: "learner" });

    await views.withLearnerWrite(async () => null);
    await views.withLearnerWrite(async () => ({ status: "unchanged" }), isApplied);
    expect(reads).toHaveLength(0);

    await expect(
      views.withLearnerWrite(async () => ({ status: "applied" }), isApplied),
    ).resolves.toStrictEqual({ status: "applied" });

    expect(reads).toHaveLength(1);
  });
});

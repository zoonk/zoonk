import { describe, expect, it } from "vitest";
import {
  type LearnerViewCopy,
  type ViewFreshness,
  isViewOld,
  pickNewerView,
} from "./learner-view-copies";

const SHOWN = { day: "goal:2026-10-15", revision: "7", userId: "learner" };
const TODAY = "goal:2026-10-15";

function copy(overrides: Partial<LearnerViewCopy<string>>): LearnerViewCopy<string> {
  return { day: null, readAt: 100, revision: "7", userId: "learner", view: "page", ...overrides };
}

function freshness(overrides: Partial<ViewFreshness> = {}): ViewFreshness {
  return {
    contentSeq: 0,
    daySeq: 0,
    deadlineSeq: 0,
    seq: 0,
    unknownWriteSeq: 0,
    watermark: null,
    ...overrides,
  };
}

/** The learner's writes reached `revision`, which the tab learned at `seq`. */
function wrote(revision: bigint, seq: number, userId = "learner"): Partial<ViewFreshness> {
  return { seq, watermark: { revision, seq, userId } };
}

function isOld({
  coveredSeq = 0,
  shown = SHOWN,
  signals,
  summaryDay = TODAY,
}: {
  coveredSeq?: number;
  shown?: typeof SHOWN;
  signals: ViewFreshness;
  summaryDay?: string | null;
}) {
  return isViewOld({ coveredSeq, freshness: signals, shown, summaryDay });
}

describe(isViewOld, () => {
  it("leaves a view alone while nothing says it's old", () => {
    expect(isOld({ signals: freshness() })).toBe(false);
  });

  it("reads once the learner's revision moved past the shown copy", () => {
    expect(isOld({ signals: freshness(wrote(8n, 1)) })).toBe(true);
  });

  it("never reads for a revision the shown copy already holds, or another learner's", () => {
    expect(isOld({ signals: freshness(wrote(7n, 1)) })).toBe(false);
    expect(isOld({ signals: freshness(wrote(9n, 1, "someone-else")) })).toBe(false);
  });

  it("reads once per signal: a read sent after it that came back no newer never reads again", () => {
    expect(isOld({ coveredSeq: 1, signals: freshness(wrote(8n, 1)) })).toBe(false);
  });

  it("reads again for a revision learned while the read that answered was out", () => {
    // The read went out at signal 1 (revision 8); revision 9 arrived while it was out.
    const shown = { ...SHOWN, revision: "8" };
    expect(isOld({ coveredSeq: 1, shown, signals: freshness(wrote(9n, 2)) })).toBe(true);
  });

  it("reads when the summary names another day: midnight, or a carried day that ended", () => {
    const signals = freshness({ daySeq: 1, seq: 1 });
    const tomorrow = "goal:2026-10-16";

    expect(isOld({ signals, summaryDay: tomorrow })).toBe(true);
    expect(isOld({ coveredSeq: 1, signals, summaryDay: tomorrow })).toBe(false);
    expect(isOld({ signals })).toBe(false);
  });

  it.each([
    { signal: "deadline", signals: freshness({ deadlineSeq: 1, seq: 1 }) },
    { signal: "write without a revision", signals: freshness({ seq: 1, unknownWriteSeq: 1 }) },
    { signal: "content arriving", signals: freshness({ contentSeq: 1, seq: 1 }) },
  ])("reads once after a $signal", ({ signals }) => {
    expect(isOld({ signals })).toBe(true);
    expect(isOld({ coveredSeq: 1, signals })).toBe(false);
  });
});

describe(pickNewerView, () => {
  it("shows the copy with the higher revision, whichever arrived last", () => {
    const page = copy({ revision: "7" });
    const read = copy({ readAt: 50, revision: "8", view: "read" });

    expect(pickNewerView(page, read)).toBe(read);
    expect(pickNewerView(read, page)).toBe(read);
  });

  it("orders two copies of one revision by when the server read them", () => {
    const page = copy({ readAt: 100 });
    const later = copy({ readAt: 200, view: "later" });

    expect(pickNewerView(page, later)).toBe(later);
  });

  it("never shows another learner's copy", () => {
    const page = copy({});
    expect(pickNewerView(page, copy({ revision: "99", userId: "someone-else" }))).toBe(page);
  });
});

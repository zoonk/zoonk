import { describe, expect, it } from "vitest";
import {
  type DayWork,
  dayBlockRefSchema,
  getDayBlockScreen,
  resolveDayBlock,
  toDayBlockRef,
} from "./day-block";

const LESSON = "766616a9-d57d-40b3-891f-067742f5837e";
const OTHER_LESSON = "c2f261a8-b154-47f5-ac96-a832828857c7";

function lesson(fields: Partial<DayWork> = {}): DayWork {
  return {
    areaId: null,
    chapterId: null,
    checkpoint: null,
    extra: false,
    fullReview: false,
    kind: "learn",
    lessonId: LESSON,
    mistakesOnly: false,
    planItemKey: `lesson:${LESSON}`,
    position: 0,
    refresh: false,
    reinforcement: false,
    weakest: false,
    ...fields,
  };
}

function mock(identity: DayWork["checkpoint"]): DayWork {
  return lesson({
    checkpoint: identity,
    kind: "checkpoint",
    lessonId: null,
    planItemKey: "mock:2020-10-09",
  });
}

describe("day work selected before a session exists", () => {
  it("routes unknown lesson readiness through the entry action while known work keeps its destination", () => {
    expect(getDayBlockScreen(lesson(), { lessonReady: null })).toBe("unknown");
    expect(getDayBlockScreen(lesson(), { lessonReady: false })).toBe("session");
    expect(getDayBlockScreen(lesson(), { lessonReady: true })).toBe("lesson");

    expect(getDayBlockScreen(lesson({ kind: "checkpoint" }), { lessonReady: null })).toBe(
      "challenge",
    );

    expect(getDayBlockScreen(lesson({ kind: "produce" }), { lessonReady: null })).toBe("essay");
  });

  it("resolves the same lesson after its position changes", () => {
    const ref = toDayBlockRef(lesson());
    const moved = lesson({ position: 2 });

    expect(resolveDayBlock({ blocks: [moved], ref })).toStrictEqual({
      block: moved,
      status: "resolved",
    });
  });

  it("never substitutes a different lesson at the tapped position", () => {
    const changed = lesson({ lessonId: OTHER_LESSON, planItemKey: `lesson:${OTHER_LESSON}` });

    expect(resolveDayBlock({ blocks: [changed], ref: toDayBlockRef(lesson()) })).toStrictEqual({
      status: "gone",
    });
  });

  it("does not confuse regular teaching with a reinforcement or bonus copy", () => {
    const ref = toDayBlockRef(lesson());

    expect(
      resolveDayBlock({ blocks: [lesson({ reinforcement: true }), lesson({ extra: true })], ref }),
    ).toStrictEqual({ status: "gone" });
  });

  it("opens a phase's practice and Content's review, never the other bonus practice", () => {
    const practice = lesson({ extra: true, kind: "practice", lessonId: null, planItemKey: null });
    const phase = { ...practice, areaId: "phase:0", position: 1 };
    const review = { ...practice, position: 2, refresh: true };
    const blocks = [practice, phase, review];

    expect(
      resolveDayBlock({ blocks, ref: dayBlockRefSchema.parse(toDayBlockRef(phase)) }),
    ).toStrictEqual({ block: phase, status: "resolved" });

    expect(
      resolveDayBlock({ blocks, ref: dayBlockRefSchema.parse(toDayBlockRef(review)) }),
    ).toStrictEqual({ block: review, status: "resolved" });
  });

  it("requires the tap to identify Content's review", () => {
    const ref = toDayBlockRef(lesson());

    const sent = {
      ...ref,
      flags: {
        extra: false,
        fullReview: false,
        mistakesOnly: false,
        reinforcement: false,
        weakest: false,
      },
    };

    expect(dayBlockRefSchema.safeParse(sent).success).toBe(false);
  });

  it("refuses ambiguous repeated work instead of choosing the first row", () => {
    expect(
      resolveDayBlock({
        blocks: [lesson(), lesson({ position: 1 })],
        ref: toDayBlockRef(lesson()),
      }),
    ).toStrictEqual({ status: "ambiguous" });
  });

  it("requires the announced exam day and length, including a known nullable day", () => {
    const checkpoint = {
      kind: "weekly" as const,
      mock: true,
      mockIdentity: { day: null, fullLength: false },
      phase: 0,
      rematch: false,
    };

    const original = mock(checkpoint);
    const ref = toDayBlockRef(original);

    expect(resolveDayBlock({ blocks: [original], ref })).toStrictEqual({
      block: original,
      status: "resolved",
    });

    expect(
      dayBlockRefSchema.safeParse({ ...ref, checkpoint: { ...checkpoint, mockIdentity: null } })
        .success,
    ).toBe(false);

    expect(
      resolveDayBlock({
        blocks: [mock({ ...checkpoint, mockIdentity: { day: null, fullLength: true } })],
        ref,
      }),
    ).toStrictEqual({ status: "gone" });
  });
});

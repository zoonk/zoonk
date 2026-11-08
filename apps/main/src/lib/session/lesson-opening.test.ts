import { type DayWork, toDayBlockRef } from "@zoonk/core/sessions/day-block";
import { describe, expect, it } from "vitest";
import { getStudyLessonHref, readLessonOpening } from "./lesson-opening";

const LESSON = "766616a9-d57d-40b3-891f-067742f5837e";
const SESSION = "c2f261a8-b154-47f5-ac96-a832828857c7";
const BLOCK = "289775ed-1f10-4589-9c4d-e429b219deaa";

const work: DayWork & { opensInPlayer: boolean } = {
  areaId: null,
  chapterId: null,
  checkpoint: null,
  extra: false,
  fullReview: false,
  kind: "learn",
  lessonId: LESSON,
  mistakesOnly: false,
  opensInPlayer: true,
  planItemKey: `lesson:${LESSON}`,
  position: 3,
  refresh: false,
  reinforcement: false,
  weakest: false,
};

describe("a lesson's URL opening intent", () => {
  it("preserves the saved block rather than selecting the first copy of a lesson", () => {
    const href = getStudyLessonHref({
      block: { ...work, id: BLOCK },
      goalId: SESSION,
      session: { id: SESSION, localDate: new Date("2026-11-07"), status: "active" },
    });

    expect(
      readLessonOpening(Object.fromEntries(new URL(href!, "https://example.test").searchParams)),
    ).toStrictEqual({ target: { blockId: BLOCK, kind: "block" } });
  });

  it.each([
    { extra: false, reinforcement: false },
    { extra: true, reinforcement: false },
    { extra: false, reinforcement: true },
    { extra: true, reinforcement: true },
  ])("round trips unopened identity with extra=$extra reinforcement=$reinforcement", (flags) => {
    const block = { ...work, ...flags };

    const href = getStudyLessonHref({
      block,
      goalId: SESSION,
      session: { localDate: new Date("2026-11-07"), status: "unstarted" },
    });

    expect(
      readLessonOpening(Object.fromEntries(new URL(href!, "https://example.test").searchParams)),
    ).toStrictEqual({
      goalId: SESSION,
      shownDate: "2026-11-07",
      target: { kind: "ref", ref: toDayBlockRef(block) },
    });
  });

  it.each([{ block: "wrong" }, { goal: "wrong", ref: "{" }, { day: "2026-11-07" }])(
    "never turns malformed study intent into a standalone start",
    (query) => {
      expect(readLessonOpening(query)).toBe("invalid");
    },
  );
});

import { describe, expect, it } from "vitest";
import { type PlannedCheckpoint, type PlannedLesson } from "../session-builder";
import { markLessonsAroundChallenges } from "./lessons-before-challenges";

const TODAY = new Date("2026-10-15T00:00:00.000Z");
const TOMORROW = new Date("2026-10-16T00:00:00.000Z");

function lesson(id: string): PlannedLesson {
  return {
    canDo: null,
    chapterId: null,
    lessonId: id,
    minutes: 4,
    planItemId: id,
    planSkillId: null,
    skillIds: [],
    title: id,
  };
}

const boss: PlannedCheckpoint = {
  itemIds: [],
  kind: "boss",
  minutes: 15,
  mock: false,
  passMark: 7,
  phase: 0,
  planItemId: "boss",
  rematch: false,
  skillIds: [],
  timeLimitMinutes: null,
  title: "Phase 1 boss",
};

// The plan's saved day: a lesson before the challenge, the challenge leading the next lesson of
// the chapter in progress, and tomorrow's lesson the day looks ahead to.
const items = [
  { id: "before", position: 3, scheduledFor: TODAY },
  { id: "boss", position: 4, scheduledFor: TODAY },
  { id: "promised", position: 5, scheduledFor: TODAY },
  { id: "tomorrow", position: 6, scheduledFor: TOMORROW },
];

const lessons = [lesson("before"), lesson("promised"), lesson("tomorrow")];

function mark(checkpoints: PlannedCheckpoint[]) {
  return markLessonsAroundChallenges({ checkpoints, items, lessons, today: TODAY }).map(
    ({ afterChallenge, beforeChallenge, lessonId }) => ({
      afterChallenge,
      beforeChallenge,
      lessonId,
    }),
  );
}

describe(markLessonsAroundChallenges, () => {
  it("marks the day's lessons before and after its first duel, and not a later day's", () => {
    expect(mark([boss])).toStrictEqual([
      { afterChallenge: undefined, beforeChallenge: true, lessonId: "before" },
      { afterChallenge: true, beforeChallenge: undefined, lessonId: "promised" },
      { afterChallenge: undefined, beforeChallenge: undefined, lessonId: "tomorrow" },
    ]);
  });

  it.each([
    ["a rematch", { ...boss, rematch: true }],
    ["the week's challenge", { ...boss, kind: "weekly" as const, planItemId: "boss" }],
  ])("marks nothing on a day with only %s", (_, checkpoint) => {
    expect(
      mark([checkpoint]).every((entry) => !entry.afterChallenge && !entry.beforeChallenge),
    ).toBe(true);
  });
});

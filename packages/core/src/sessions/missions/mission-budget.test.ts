import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { STUDY_SESSION_INCLUDE } from "../_utils/study-session-access";
import { toBlockPayload } from "../block-payload";
import { type PlannedBlock } from "../session-builder";
import { loadDayMissionFacts } from "./day-facts";
import { getDayMissions } from "./get-day-missions";
import { pickMissions } from "./pick-missions";
import { settleMissions } from "./settle-missions";

const localDate = new Date("2026-10-13T00:00:00Z");
const now = new Date("2026-10-13T12:00:00Z");

async function day(
  dailyMinutes: number,
  durations: number[],
  extra = false,
  limitMinutes?: number,
) {
  const [user, skill, lesson] = await Promise.all([
    userFixture(),
    skillFixture(),
    libraryLessonFixture({ estimatedMinutes: durations[1] ?? dailyMinutes }),
  ]);

  const goal = await goalFixture({ dailyMinutes, userId: user.id });

  if (limitMinutes !== undefined) {
    await learningProfileFixture({ dailyLimitMinutes: limitMinutes, userId: user.id });
  }

  const plan = await planFixture({ goalId: goal.id });
  const item = await planItemFixture({ lessonId: lesson.id, planId: plan.id, skillId: skill.id });
  const material = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

  await Promise.all(
    Array.from({ length: 5 }, () =>
      mistakeFixture({
        createdAt: new Date("2026-10-01"),
        itemId: material.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ),
  );

  await studySessionFixture({
    goalId: goal.id,
    localDate: new Date("2026-10-12"),
    startedAt: now,
    userId: user.id,
  });

  const blocks: PlannedBlock[] = durations.map((estimatedMinutes, position) => ({
    canDo: null,
    estimatedMinutes,
    kind: position === 0 ? "review" : "learn",
    lessonId: position === 0 ? null : lesson.id,
    payload: toBlockPayload(position === 0 ? { extra } : { planItemId: item.id }),
  }));

  const plannedMinutes = durations.reduce((sum, minutes) => sum + minutes, 0);

  const facts = await loadDayMissionFacts({
    blocks,
    goal,
    localDate,
    now,
    plannedMinutes,
    timeZone: "UTC",
    userId: user.id,
  });

  const picks = pickMissions(facts);

  const session = await studySessionFixture({
    goalId: goal.id,
    localDate,
    missions: { picks, version: 1 },
    plannedMinutes,
    userId: user.id,
  });

  await Promise.all(
    blocks.map((block, position) =>
      studySessionBlockFixture({
        ...block,
        payload: block.payload,
        position,
        sessionId: session.id,
      }),
    ),
  );

  const stored = await prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: session.id },
  });

  const missions = await getDayMissions({ session: stored, timeZone: "UTC" });
  return { missions, picks, plannedMinutes, session: stored };
}

describe("daily missions fit the learner's planned time", () => {
  it("keeps a fitting pick on a 10-minute day even when the preferred review cannot fit", async () => {
    const { missions } = await day(10, [12, 8]);
    expect(missions).toHaveLength(1);
    expect(missions[0]).toMatchObject({ kind: "somethingNew", minutes: 8 });
  });

  it("keeps a fitting outside drill when a short day has no planned mission candidate", async () => {
    const { missions } = await day(10, [1], true);
    expect(missions).toMatchObject([{ kind: "fixMistake", minutes: 2, total: 1 }]);
    expect(missions).toHaveLength(1);
  });

  it("does not add work beyond a full 15-minute session", async () => {
    const { missions, session } = await day(15, [5, 10]);
    expect(missions.map((mission) => mission.kind)).toStrictEqual(["review", "somethingNew"]);
    expect(missions.reduce((sum, mission) => sum + (mission.minutes ?? 0), 0)).toBe(15);

    await prisma.studySessionBlock.updateMany({
      data: { completedAt: now, status: "completed" },
      where: { sessionId: session.id },
    });

    await expect(
      settleMissions({ sessionId: session.id, timeZone: "UTC", userId: session.userId }),
    ).resolves.toMatchObject({ fullMealPaid: true });

    await expect(
      settleMissions({ sessionId: session.id, timeZone: "UTC", userId: session.userId }),
    ).resolves.toMatchObject({ fullMealPaid: false });
  });

  it("fits the learner's remaining daily cap when it is shorter than the goal's day", async () => {
    const { missions, plannedMinutes } = await day(30, [8, 8], false, 18);
    const fixes = missions.find((mission) => mission.kind === "fixMistake");
    expect(fixes).toMatchObject({ minutes: 2, total: 1 });
    expect(plannedMinutes + (fixes?.minutes ?? 0)).toBe(18);
  });

  it("sizes fixes to the four minutes left on a 30-minute day", async () => {
    const { missions, picks, plannedMinutes } = await day(30, [4, 22]);
    expect(picks.find((pick) => pick.kind === "fixMistake")).toMatchObject({ total: 2 });
    const fixes = missions.find((mission) => mission.kind === "fixMistake");
    expect(fixes).toMatchObject({ minutes: 4, total: 2 });
    expect(plannedMinutes + (fixes?.minutes ?? 0)).toBe(30);
  });
});

import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { session as sessionBoundary } from "../_test-utils/test-boundaries";
import { getTargetLevel, loadLanguageSkillLevels } from "../language/levels/language-skill-levels";
import { getOwnLevel } from "../learner/placement/placement-contract";
import { addDays, toIsoDate } from "../plans/planner/plan-calendar";
import { readMissionDocument } from "../sessions/missions/catalog";
import { getOnboarding } from "../view-models/onboarding/get-onboarding";
import { seedPersonaCopy } from "./seed";

const FRIDAY = new Date("2026-10-16T20:52:12Z");
const TODAY = new Date("2026-10-16T00:00:00Z");
const HISTORY_DAYS = 14;

const ANA_STUDY_DATES = Array.from({ length: HISTORY_DAYS }, (_, index) =>
  toIsoDate(addDays(TODAY, index - HISTORY_DAYS)),
);

async function listStudyDates(userId: string): Promise<string[]> {
  const days = await prisma.dailyProgress.findMany({
    orderBy: { date: "asc" },
    select: { date: true },
    where: { date: { lt: TODAY }, userId },
  });

  return days.map((day) => toIsoDate(day.date));
}

describe("a persona's copy", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FRIDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads Ana's exam facts and existing seven-day schedule through onboarding", async () => {
    const copy = await seedPersonaCopy({
      copyKey: "exam-facts",
      email: "seed-exam-facts@zoonk.test",
      persona: "exam",
    });

    sessionBoundary.getSession.mockResolvedValue({ user: { id: copy.userId } });
    const result = await getOnboarding({ goalId: copy.goalId });
    expect(result.status).toBe("ready");

    if (result.status !== "ready") {
      throw new Error("Seeded onboarding unavailable");
    }

    expect(result.onboarding.goal.details).toMatchObject({
      examName: "ENEM",
      examTarget: "admission",
      institution: "UFMG",
      level: "intermediate",
      targetCourse: "Medicina",
      targetScore: "720",
    });

    expect(result.onboarding.goal.studyDays).toStrictEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it.each(["buddy", "hugeGoal"] as const)("reads %s's beginner level", async (persona) => {
    const copy = await seedPersonaCopy({
      copyKey: `level-${persona}`,
      email: `seed-level-${persona}@zoonk.test`,
      persona,
    });

    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: copy.goalId } });
    expect(getOwnLevel({ goal })).toBe("none");

    expect(goal.details).toMatchObject({
      levelNote: persona === "buddy" ? "nada ainda" : "nothing yet",
    });
  });

  it("reads Marcos's tested skills and language target", async () => {
    const copy = await seedPersonaCopy({
      copyKey: "language-facts",
      email: "seed-language-facts@zoonk.test",
      persona: "language",
    });

    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: copy.goalId } });
    const details = goal.details as Record<string, unknown>;
    expect(getTargetLevel(details)?.label).toBe("B1+");

    const levels = await loadLanguageSkillLevels({
      details,
      language: goal.targetLanguage!,
      userId: copy.userId,
    });

    expect(
      Object.fromEntries(levels.map((level) => [level.skill, level.startLabel])),
    ).toStrictEqual({ listening: "A2", reading: "B1", speaking: "A2", writing: "A2" });
  });

  it.each(["535d0cba", "ef53361d"])(
    "has Ana's study days and her Friday under copy key %s",
    async (copyKey) => {
      const copy = await seedPersonaCopy({
        copyKey,
        email: `persona-copy-${copyKey}@zoonk.test`,
        persona: "exam",
      });

      const [dates, today] = await Promise.all([
        listStudyDates(copy.userId),
        prisma.studySession.findFirstOrThrow({
          select: { freshStart: true },
          where: { localDate: TODAY, userId: copy.userId },
        }),
      ]);

      expect({ dates, freshStart: today.freshStart }).toStrictEqual({
        dates: ANA_STUDY_DATES,
        freshStart: null,
      });

      const sessions = await prisma.studySession.findMany({
        where: { localDate: { lt: TODAY }, userId: copy.userId },
      });

      const missions = sessions.map((session) => readMissionDocument(session.missions));

      expect(missions).toHaveLength(HISTORY_DAYS);
      expect(missions.every((document) => document !== null)).toBe(true);
      expect(missions.some((document) => (document?.picks.length ?? 0) > 0)).toBe(true);
    },
  );
});

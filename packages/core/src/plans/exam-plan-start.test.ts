import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import {
  choiceItemContent,
  itemFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { answerPlacementQuestion } from "../learner/placement/answer-placement-question";
import { finishGoalPlacement } from "../learner/placement/finish-goal-placement";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** A Monday in 2020, before the learning events other tests write, six weeks before the exam. */
const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";
const RIGHT = { selectedIndex: 0 };
const LESSONS_PER_SKILL = 12;

/**
 * An adult's public-service exam whose skills are still one stand-in each while placement runs:
 * a Portuguese foundation (word classes, which the exam doesn't ask on its own), rewriting at the
 * exam's depth, logic and law.
 */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Portuguese", lessons: 0, size: LESSONS_PER_SKILL, weight: 1 },
      { area: "Portuguese", lessons: 0, size: LESSONS_PER_SKILL, weight: 5 },
      { area: "Logic", lessons: 0, size: LESSONS_PER_SKILL, weight: 4 },
      { area: "Law", lessons: 0, size: LESSONS_PER_SKILL, weight: 3 },
    ],
  });

  const [foundation, rewrite] = library.skills;

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 60,
    kind: "exam",
    settings: { startDate: TODAY },
    targetDate: new Date("2020-11-08T00:00:00Z"),
    userId: user.id,
  });

  const [items] = await Promise.all([
    Promise.all(
      [1, 2].map(() =>
        itemFixture({ content: choiceItemContent(), skillId: foundation?.id ?? "" }),
      ),
    ),
    skillPrerequisiteFixture({ prerequisiteId: foundation?.id ?? "", skillId: rewrite?.id ?? "" }),
  ]);

  mockSession(user.id);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(`${TODAY}T00:00:00Z`),
    currentInstant: NOW,
    timeZone: "UTC",
  });

  return { goal, items, library, plan };
}

/** The course outlines land: each skill gets its chapter's lessons. */
async function outlineSkills(skillIds: readonly string[]) {
  await Promise.all(
    skillIds.map(async (skillId) => {
      const chapter = await libraryChapterFixture({ title: `Chapter ${skillId}` });

      await Promise.all(
        Array.from({ length: LESSONS_PER_SKILL }, async (_, position) => {
          const lesson = await libraryLessonFixture({ estimatedMinutes: 3 });

          await Promise.all([
            chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
            lessonSkillFixture({ lessonId: lesson.id, skillId }),
          ]);
        }),
      );
    }),
  );
}

describe("an exam plan after placement", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps what placement showed the learner knows out once its lessons are outlined, and mixes the exam's areas from day 1", async () => {
    const { goal, items, library, plan } = await setup();
    const [foundation, rewrite] = library.skills;

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    await Promise.all(
      items.map((item) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: { answer: RIGHT, durationMs: 4000, itemId: item.id, timeZone: "UTC" },
        }),
      ),
    );

    const finished = await finishGoalPlacement({ goalId: goal.id, input: { timeZone: "UTC" } });

    expect(finished.status === "ready" && finished.completion.knownSkillIds).toContain(
      foundation?.id,
    );

    await outlineSkills(library.skills.map((skill) => skill.id));
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const planned = await prisma.planItem.findMany({
      include: { lesson: { select: { skills: { select: { skillId: true } } } } },
      orderBy: { position: "asc" },
      where: { kind: "lesson", planId: plan.id, status: "todo" },
    });

    const skillOf = (item: (typeof planned)[number]) =>
      item.skillId ?? item.lesson?.skills[0]?.skillId ?? null;

    expect(planned.some((item) => skillOf(item) === foundation?.id)).toBe(false);
    const [first] = planned;

    expect(first && skillOf(first)).toBe(rewrite?.id);

    const dayOne = planned.filter(
      (item) => item.scheduledFor?.toISOString().slice(0, 10) === TODAY,
    );

    const areaOf = (item: (typeof planned)[number]) =>
      library.graph.skills.find((skill) => skill.skillId === skillOf(item))?.area;

    expect(new Set(dayOne.map((item) => areaOf(item))).size).toBeGreaterThanOrEqual(2);
    expect(dayOne.length).toBeGreaterThan(0);
  });
});

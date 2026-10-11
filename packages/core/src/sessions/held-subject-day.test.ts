import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { listeningExamFixture } from "@zoonk/testing/fixtures/listening";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { DAY_MS, SESSION_NOW, SESSION_TODAY, sessionGoalFixture } from "./_test-utils/session-goal";
import { loadSessionBuildInput } from "./_utils/load-build-inputs";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const TOMORROW = new Date(SESSION_TODAY.getTime() + DAY_MS);

/** A skill of the plan's graph in a subject. */
function graphSkill(area: string, skillId: string | undefined) {
  return { area, lessons: 6, name: area, phase: 0, skillId: skillId ?? "", weight: 4 };
}

/**
 * Rafaela's Câmara day one: the plan gives linguistics two written lessons today and IT its first
 * lessons, which the Library hasn't written yet (a stand-in holds their place); linguistics has
 * more lessons written for tomorrow. Placement wrote questions on every skill.
 */
async function camaraDayOne({ held = "TI" }: { held?: string } = {}) {
  const user = await userFixture();
  const exam = held === "Listening" ? await listeningExamFixture() : null;

  const { goal, plan, planItems, skills } = await sessionGoalFixture({
    goal: {
      examBlueprintId: exam?.blueprint.id ?? null,
      kind: "exam",
      targetDate: new Date(SESSION_TODAY.getTime() + 60 * DAY_MS),
      targetLanguage: exam ? "en" : null,
    },
    lessons: 3,
    userId: user.id,
  });

  const [ling, ling2, ti] = skills;

  const later = await Promise.all(
    [1, 2, 3, 4].map((index) => libraryLessonFixture({ title: `Linguística later ${index}` })),
  );

  await Promise.all([
    prisma.plan.update({
      data: {
        graph: {
          phases: [{ milestone: null, name: "Basics" }],
          skills: [
            graphSkill("Linguística", ling?.id),
            graphSkill("Linguística", ling2?.id),
            graphSkill(held, ti?.id),
          ],
        },
      },
      where: { id: plan.id },
    }),
    ...planItems
      .slice(0, 2)
      .map((item, index) =>
        prisma.planItem.update({
          data: { scheduledFor: SESSION_TODAY, skillId: skills[index]?.id ?? null },
          where: { id: item.id },
        }),
      ),
    prisma.planItem.update({
      data: { lessonId: null, lessons: 3, scheduledFor: SESSION_TODAY, skillId: ti?.id ?? null },
      where: { id: planItems[2]?.id },
    }),
    prisma.lessonSkill.deleteMany({ where: { skillId: ti?.id ?? "" } }),
    ...later.map((lesson, index) =>
      Promise.all([
        lessonSkillFixture({ lessonId: lesson.id, skillId: ling?.id ?? "" }),
        planItemFixture({
          kind: "lesson",
          lessonId: lesson.id,
          phase: 0,
          planId: plan.id,
          position: 10 + index,
          scheduledFor: TOMORROW,
          skillId: ling?.id ?? null,
          titleSnapshot: lesson.title,
        }),
      ]),
    ),
  ]);

  mockSession(user.id);

  const input = await loadSessionBuildInput({
    goal: await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    localDate: SESSION_TODAY,
    now: SESSION_NOW,
    timeZone: "UTC",
    userId: user.id,
  });

  return { input, later, ti };
}

describe("an exam day whose subject has nothing written yet", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Rafaela's day one was 27 linguistics lessons: IT's lessons weren't written, and the day gave
  // its time to more of the subject it had.
  it("keeps that subject's time for its questions instead of more of another subject", async () => {
    const { input, later, ti } = await camaraDayOne();
    const laterIds = new Set(later.map((lesson) => lesson.id));

    expect(input.lessons.some((lesson) => laterIds.has(lesson.lessonId ?? ""))).toBe(false);
    expect(input.practice[0]?.skillId).toBe(ti?.id);
  });

  // An exam's listening skills are practiced only with recordings: with none voiced yet, holding
  // the listening subject's time would leave it to practice that asks nothing.
  it("gives a listening subject's time to the others while none of its recordings is voiced", async () => {
    const { input, later, ti } = await camaraDayOne({ held: "Listening" });
    const laterIds = new Set(later.map((lesson) => lesson.id));

    expect(input.lessons.some((lesson) => laterIds.has(lesson.lessonId ?? ""))).toBe(true);
    expect(input.practice.some((item) => item.skillId === ti?.id)).toBe(false);
  });
});

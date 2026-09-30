import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { announceTestedOutItems } from "../../plans/announce-tested-out-items";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { replanGoalsWaitingOnSkills } from "./replan-waiting-goals";
import { listSkillExtensions, planSkillExtensions } from "./skill-extensions";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

vi.mock("../../progress/get-request-date-context", () => ({
  getRequestProgressDateContext: vi.fn(),
}));

vi.mock("../../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** A Monday in 2020, before the learning events other tests write, so no one's pace moves dates. */
const NOW = new Date("2020-09-28T12:00:00Z");

/** What the graph says describing work experience takes; the course has a chapter of five. */
const SKILL_LESSONS = 20;
const OUTLINED_LESSONS = 5;

async function addChapter({
  courseId,
  lessons,
  position,
  skillId,
  title,
}: {
  courseId: string;
  lessons: number;
  position: number;
  skillId: string;
  title: string;
}) {
  const chapter = await libraryChapterFixture({ language: "pt", targetLanguage: "en", title });

  const created = await Promise.all(
    Array.from({ length: lessons }, (_, index) =>
      libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapter.id,
        language: "pt",
        targetLanguage: "en",
        title: `${title} ${index + 1}`,
      }),
    ),
  );

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId, level: "beginner", position }),
    prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId } }),
    ...created.map((lesson, index) =>
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: index }),
    ),
  ]);

  return chapter;
}

/**
 * A language goal planned from a course that teaches "describe work experience" in one chapter of
 * five lessons, while the graph gives it twenty: the plan holds a stand-in for the other fifteen.
 */
async function setup({ dailyMinutes = 30 }: { dailyMinutes?: number } = {}) {
  const [user, course, skill] = await Promise.all([
    userFixture(),
    courseFixture({ language: "pt", targetLanguage: "en", title: "Inglês" }),
    skillFixture({
      description: "Falar sobre empregos anteriores.",
      language: "pt",
      name: `Descrever experiência profissional ${crypto.randomUUID()}`,
      targetLanguage: "en",
    }),
  ]);

  const chapter = await addChapter({
    courseId: course.id,
    lessons: OUTLINED_LESSONS,
    position: 0,
    skillId: skill.id,
    title: "Candidaturas e entrevistas",
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    kind: "language",
    language: "pt",
    primaryCourseId: course.id,
    settings: { startDate: "2020-09-28" },
    targetLanguage: "en",
    userId: user.id,
  });

  mockSession(user.id);

  await createGoalPlan({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Trabalho" }],
      skills: [
        {
          area: "Inglês",
          courseIds: [course.id],
          lessons: SKILL_LESSONS,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        },
      ],
    },
  });

  return { chapter, course, goal, plan, skill, user };
}

/**
 * A learn goal like quantum physics from zero: each skill has a chapter of its own in one course,
 * with `outlined` lessons, while the graph gives it `lessons`.
 */
async function learnSetup(skills: { lessons: number; outlined: number }[]) {
  const [user, course, ...created] = await Promise.all([
    userFixture(),
    courseFixture({ title: "Quantum physics" }),
    ...skills.map((_, index) =>
      skillFixture({ name: `Quantum skill ${index + 1} ${crypto.randomUUID()}` }),
    ),
  ]);

  await Promise.all(
    skills.map((spec, index) =>
      addChapter({
        courseId: course.id,
        lessons: spec.outlined,
        position: index,
        skillId: created[index]?.id ?? "",
        title: `Quantum chapter ${index + 1}`,
      }),
    ),
  );

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    kind: "learn",
    primaryCourseId: course.id,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  mockSession(user.id);

  await createGoalPlan({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Foundations" }],
      skills: skills.map((spec, index) => ({
        area: "Quantum physics",
        courseIds: [course.id],
        lessons: spec.lessons,
        name: created[index]?.name ?? "",
        phase: 0,
        skillId: created[index]?.id ?? "",
        weight: null,
      })),
    },
  });

  return { course, goal, plan, skills: created };
}

function planItems(planId: string) {
  return prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId } });
}

describe("skill extensions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for the next chapter of a skill whose stand-in is due soon, in its course and band", async () => {
    const { course, goal, skill } = await setup();

    await expect(listSkillExtensions({ goalId: goal.id, timeZone: "UTC" })).resolves.toStrictEqual([
      {
        bands: [
          {
            extend: [
              {
                lessons: SKILL_LESSONS,
                skill: {
                  description: skill.description,
                  id: skill.id,
                  key: skill.id,
                  name: skill.name,
                },
              },
            ],
            level: "beginner",
            skills: [],
          },
        ],
        courseId: course.id,
        scope: { generalGoal: null, language: "pt", ownerId: null, targetLanguage: "en" },
      },
    ]);
  });

  it("sizes a quantum-like learn goal from the graph and asks one run for its course", async () => {
    const { course, goal, plan, skills } = await learnSetup([
      { lessons: 30, outlined: 5 },
      { lessons: 40, outlined: 6 },
      { lessons: 25, outlined: 4 },
    ]);

    const items = await planItems(plan.id);
    const standIns = items.filter((item) => item.kind === "lesson" && !item.lessonId);

    expect(standIns.map((item) => item.skillId)).toStrictEqual(skills.map((skill) => skill.id));

    const soon = standIns
      .filter((item) => (item.scheduledFor ?? NOW) <= new Date("2020-10-12T00:00:00Z"))
      .map((item) => item.skillId);

    const requests = await listSkillExtensions({ goalId: goal.id, timeZone: "UTC" });

    expect(requests.map((request) => request.courseId)).toStrictEqual([course.id]);
    expect(requests[0]?.bands).toHaveLength(1);

    expect(requests[0]?.bands[0]?.extend?.map((extension) => extension.skill.id)).toStrictEqual(
      soon,
    );

    expect(soon.length).toBeGreaterThan(0);
    expect(soon).not.toContain(skills[2]?.id);
  });

  it("gives a skill only a few lessons short neither a stand-in nor a next chapter", async () => {
    const { goal, plan } = await learnSetup([{ lessons: 8, outlined: 5 }]);
    const items = await planItems(plan.id);

    expect(items.filter((item) => item.kind === "lesson" && !item.lessonId)).toStrictEqual([]);

    await expect(listSkillExtensions({ goalId: goal.id, timeZone: "UTC" })).resolves.toStrictEqual(
      [],
    );
  });

  it("asks for nothing while the course's outline is being written", async () => {
    const { course, goal } = await setup();

    await prisma.course.update({ data: { outlineStatus: "running" }, where: { id: course.id } });

    await expect(listSkillExtensions({ goalId: goal.id, timeZone: "UTC" })).resolves.toStrictEqual(
      [],
    );
  });

  it("waits while the stand-in is more than two weeks away", async () => {
    // At 5 minutes a day, the five written lessons alone take about a week.
    const { goal } = await setup({ dailyMinutes: 5 });

    await expect(listSkillExtensions({ goalId: goal.id, timeZone: "UTC" })).resolves.toStrictEqual(
      [],
    );
  });

  it("sizes the next chapter to the lessons still missing, capped, after the chapters so far", async () => {
    const { chapter, course, skill } = await setup();
    const ref = { description: skill.description, id: skill.id, key: skill.id, name: skill.name };

    // 20 lessons: capped at 10; 10: the 5 missing; 8: only 3 short, less than a chapter.
    const [capped, small, few] = await Promise.all(
      [SKILL_LESSONS, 10, 8].map((lessons) =>
        planSkillExtensions({
          courseId: course.id,
          extensions: [{ lessons, skill: ref }],
          ownerId: null,
        }),
      ),
    );

    expect(capped).toStrictEqual([
      {
        afterChapterId: chapter.id,
        chapters: [
          {
            lessons: Array.from(
              { length: OUTLINED_LESSONS },
              (_, index) => `Candidaturas e entrevistas ${index + 1}`,
            ),
            title: "Candidaturas e entrevistas",
          },
        ],
        lessons: 10,
        level: "beginner",
        skill: ref,
      },
    ]);

    expect(small?.map((plan) => plan.lessons)).toStrictEqual([5]);
    expect(few).toStrictEqual([]);
  });

  it("swaps the next chapter's lessons in for part of the stand-in when the goal re-plans", async () => {
    const { course, goal, plan, skill } = await setup();
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await addChapter({
      courseId: course.id,
      lessons: 4,
      position: 1,
      skillId: skill.id,
      title: "Entrevistas com perguntas situacionais",
    });

    await expect(replanGoalsWaitingOnSkills({ skillIds: [skill.id] })).resolves.toStrictEqual([
      goal.id,
    ]);

    const [items, after] = await Promise.all([
      planItems(plan.id),
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
    ]);

    const lessons = items.filter((item) => item.kind === "lesson");

    expect(lessons.filter((item) => item.lessonId)).toHaveLength(OUTLINED_LESSONS + 4);

    expect(lessons.filter((item) => !item.lessonId).map((item) => item.skillId)).toStrictEqual([
      skill.id,
    ]);

    // The skill keeps the graph's size: written lessons replace part of the stand-in.
    expect(after.estimateHours).toBeCloseTo(before.estimateHours ?? 0);
  });

  it("counts a tested-out stand-in as the lessons it still stood for", async () => {
    const { goal, plan } = await setup();
    const items = await planItems(plan.id);
    const tested = items.filter((item) => item.kind === "lesson");

    await prisma.planItem.updateMany({
      data: { completedAt: NOW, status: "testedOut" },
      where: { id: { in: tested.map((item) => item.id) } },
    });

    await announceTestedOutItems({
      goalId: goal.id,
      now: NOW,
      planItemIds: tested.map((item) => item.id),
      timeZone: "UTC",
    });

    const change = await prisma.planChange.findFirstOrThrow({
      where: { kind: "testedOut", planId: plan.id },
    });

    expect(change.payload).toMatchObject({ lessons: SKILL_LESSONS });
  });
});

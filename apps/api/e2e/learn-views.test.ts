import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { syllabusViewSchema } from "@zoonk/core/view-models/syllabus/contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  attemptFixture,
  learnerSkillFixture,
  mistakeFixture,
} from "@zoonk/testing/fixtures/learner";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import {
  areaPracticeResponseSchema,
  goalContentResponseSchema,
  goalProgressResponseSchema,
} from "../src/lib/openapi/schemas/learn-views";
import { createAuthenticatedApiContext } from "./helpers/auth";

/**
 * A goal with one chapter of three skills (one of them mastered, with the answer that shows it), a
 * finished lesson and a mistake.
 */
async function createGoal(userId: string) {
  const [goal, chapter, lesson, skills] = await Promise.all([
    goalFixture({ title: "Percentages for the exam", userId }),
    libraryChapterFixture({ title: "Percentages" }),
    libraryLessonFixture(),
    Promise.all([1, 2, 3].map((index) => skillFixture({ name: `Skill ${index}` }))),
  ]);

  const plan = await planFixture({ goalId: goal.id });

  await Promise.all([
    ...skills.map((skill, position) =>
      planItemFixture({ chapterId: chapter.id, planId: plan.id, position, skillId: skill.id }),
    ),
    planItemFixture({
      completedAt: new Date(),
      lessonId: lesson.id,
      planId: plan.id,
      position: 3,
      status: "done",
    }),
    learnerSkillFixture({
      lastReviewedAt: new Date(),
      recallDays: 3,
      reps: 4,
      skillId: skills[0]?.id ?? "",
      stability: 60,
      state: "mastered",
      userId,
    }),
    // Preparation counts a skill from the learner's first answer on it, never from state alone.
    attemptFixture({ skillId: skills[0]?.id ?? "", userId }),
    mistakeFixture({ skillId: skills[1]?.id ?? null, userId }),
  ]);

  return { chapter, goal };
}

test.describe("Learning tab views API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication and hides other learners' goals", async () => {
    const anonymous = await request.newContext({ baseURL });
    const goalId = randomUUID();

    const unauthorized = await Promise.all([
      anonymous.get(`/v1/goals/${goalId}/progress`),
      anonymous.get(`/v1/goals/${goalId}/content`),
      anonymous.get(`/v1/goals/${goalId}/syllabus`),
      anonymous.post(`/v1/goals/${goalId}/area-practice`, { data: { areaId: "any" } }),
    ]);

    expect(unauthorized.map((response) => response.status())).toStrictEqual([401, 401, 401, 401]);
    await anonymous.dispose();

    const [{ apiContext }, owner] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "learn-views-hidden" }),
      userFixture(),
    ]);

    const { goal } = await createGoal(owner.id);

    const [progress, content, syllabus, invalid] = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}/progress`),
      apiContext.get(`/v1/goals/${goal.id}/content`),
      apiContext.get(`/v1/goals/${goal.id}/syllabus`),
      apiContext.get("/v1/goals/not-a-uuid/syllabus"),
    ]);

    expect(
      [progress, content, syllabus, invalid].map((response) => response.status()),
    ).toStrictEqual([404, 404, 404, 400]);

    await apiContext.dispose();
  });

  test("returns the Progress tab's view model", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "learn-views-progress",
    });

    const { chapter, goal } = await createGoal(user.id);

    const response = await apiContext.get(`/v1/goals/${goal.id}/progress`);
    expect(response.status()).toBe(200);

    const progress = goalProgressResponseSchema.parse(await response.json());

    expect(progress.goal).toMatchObject({ id: goal.id, title: "Percentages for the exam" });
    expect(progress.preparation?.skills).toMatchObject({ mastered: 1, total: 3 });
    expect(progress.mistakes).toStrictEqual({ open: 1 });

    // The mastered skill is there; the two new ones are still needed, with the plan's time for them.
    expect(progress.stillNeeded).toMatchObject({
      areas: [
        {
          areaId: chapter.id,
          left: [{ name: "Skill 2" }, { name: "Skill 3" }],
          title: "Percentages",
          total: 3,
        },
      ],
      left: 2,
      rule: "solid",
    });

    expect(progress.stillNeeded.minutes).toBeGreaterThan(0);
    expect(progress.preparation?.estimatedScore).toBeNull();
    await apiContext.dispose();
  });

  test("returns the Content tab's view model", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "learn-views-content",
    });

    const { goal } = await createGoal(user.id);

    const response = await apiContext.get(`/v1/goals/${goal.id}/content`);
    expect(response.status()).toBe(200);

    const content = goalContentResponseSchema.parse(await response.json());

    expect(content.counts).toMatchObject({ mastered: 1, new: 2, total: 3 });

    expect(content.groups[0]?.cards.map((card) => [card.name, card.state])).toStrictEqual([
      ["Skill 1", "mastered"],
      ["Skill 2", "new"],
      ["Skill 3", "new"],
    ]);

    // Without a skill graph naming courses, chapters sit in no section.
    expect(content.groups[0]?.section).toBeNull();

    await apiContext.dispose();
  });

  test("returns a goal's syllabus: its modules with their chapters and progress", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "learn-views-syllabus",
    });

    const [goal, research, figma, interview, prototype] = await Promise.all([
      goalFixture({ title: "Become a UX designer", userId: user.id }),
      libraryChapterFixture({ title: "User interviews" }),
      libraryChapterFixture({ title: "Prototypes in Figma" }),
      skillFixture({ name: "Run a user interview" }),
      skillFixture({ name: "Prototype a flow" }),
    ]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Foundations" }],
        skills: [
          {
            area: "User research",
            lessons: 1,
            name: interview.name,
            phase: 0,
            skillId: interview.id,
          },
          {
            area: "Prototyping",
            lessons: 1,
            name: prototype.name,
            phase: 0,
            skillId: prototype.id,
          },
        ],
      },
    });

    await Promise.all([
      planItemFixture({
        chapterId: research.id,
        planId: plan.id,
        position: 0,
        skillId: interview.id,
        status: "done",
      }),
      planItemFixture({
        chapterId: figma.id,
        planId: plan.id,
        position: 1,
        scheduledFor: new Date("2026-10-07T00:00:00.000Z"),
        skillId: prototype.id,
      }),
    ]);

    const response = await apiContext.get(`/v1/goals/${goal.id}/syllabus`);
    expect(response.status()).toBe(200);

    const syllabus = syllabusViewSchema.parse(await response.json());

    expect(syllabus).toMatchObject({ kind: "modules", topicCount: 0, topicsMapped: false });

    expect(
      syllabus.subjects.map((subject) => [
        subject.key,
        subject.name,
        subject.lessonsDone,
        subject.lessonsTotal,
        subject.chapters.map((chapter) => [chapter.chapterId, chapter.state, chapter.nextDate]),
      ]),
    ).toStrictEqual([
      ["user-research", "User research", 1, 1, [[research.id, "done", null]]],
      ["prototyping", "Prototyping", 0, 1, [[figma.id, "current", "2026-10-07"]]],
    ]);

    await apiContext.dispose();
  });

  test("adds area practice to today's session, and a second tap returns the same block", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "learn-views-practice",
    });

    const { chapter, goal } = await createGoal(user.id);

    const invalid = await apiContext.post(`/v1/goals/${goal.id}/area-practice`, { data: {} });
    expect(invalid.status()).toBe(400);

    const missing = await apiContext.post(`/v1/goals/${goal.id}/area-practice`, {
      data: { areaId: "not-an-area", timeZone: "UTC" },
    });

    expect(missing.status()).toBe(404);

    const first = await apiContext.post(`/v1/goals/${goal.id}/area-practice`, {
      data: { areaId: chapter.id, timeZone: "UTC" },
    });

    expect(first.status()).toBe(201);

    const created = areaPracticeResponseSchema.parse(await first.json());
    expect(created.block.extra).toBe(true);

    const again = await apiContext.post(`/v1/goals/${goal.id}/area-practice`, {
      data: { areaId: chapter.id, timeZone: "UTC" },
    });

    expect(areaPracticeResponseSchema.parse(await again.json()).block.id).toBe(created.block.id);
    await apiContext.dispose();
  });
});

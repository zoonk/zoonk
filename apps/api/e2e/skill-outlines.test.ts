import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { skillOutlineSchema } from "@zoonk/core/lookahead/skill-outline-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { skillOutlineGenerationSchema } from "../src/lib/openapi/schemas/skill-outlines";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

const ACCEPTED = 202;
const PAYMENT_REQUIRED = 402;
const DAY_MS = 86_400_000;

/**
 * A goal whose plan has `count` topics, each of its own subject, all months away, none written
 * yet: while a subject's outline is being written, its other topics read as being written too.
 */
async function createFarGoal({ count = 1, userId }: { count?: number; userId: string }) {
  const [goal, topics] = await Promise.all([
    goalFixture({ timezone: "UTC", title: "Learn statistics", userId }),
    Promise.all(
      Array.from({ length: count }, async () => {
        const [course, skill] = await Promise.all([
          courseFixture({ language: "en", title: `Statistics ${randomUUID().slice(0, 6)}` }),
          skillFixture({ level: "beginner" }),
        ]);

        return { course, skill };
      }),
    ),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "One" }],
      skills: topics.map(({ course, skill }) => ({
        area: null,
        courseIds: [course.id],
        lessons: 12,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  await Promise.all(
    topics.map(({ skill }, position) =>
      planItemFixture({
        planId: plan.id,
        position,
        scheduledFor: new Date(Date.now() + (60 + position) * DAY_MS),
        skillId: skill.id,
      }),
    ),
  );

  const [first] = topics;

  if (!first) {
    throw new Error("A far goal needs at least one topic.");
  }

  return { first, goal, topics };
}

function outlinePath({ goalId, skillId }: { goalId: string; skillId: string }) {
  return `/v1/goals/${goalId}/skills/${skillId}/outline`;
}

test.describe("Far topics' lesson plans API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication and hides other learners' goals", async () => {
    const anonymous = await request.newContext({ baseURL });
    const path = outlinePath({ goalId: randomUUID(), skillId: randomUUID() });

    const statuses = await Promise.all([
      anonymous.get(path),
      anonymous.post(`${path}/generations`),
    ]);

    expect(statuses.map((response) => response.status())).toStrictEqual([401, 401]);

    const { apiContext } = await createAuthenticatedApiContext({ baseURL, prefix: "outline-own" });
    const stranger = await userFixture();
    const other = await createFarGoal({ userId: stranger.id });
    const otherPath = outlinePath({ goalId: other.goal.id, skillId: other.first.skill.id });

    const hidden = await Promise.all([
      apiContext.get(otherPath),
      apiContext.post(`${otherPath}/generations`),
    ]);

    expect(hidden.map((response) => response.status())).toStrictEqual([404, 404]);
    await Promise.all([anonymous.dispose(), apiContext.dispose()]);
  });

  test("writes a far topic's lesson plan on request, counting it once", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "outline-write",
    });

    const { first, goal } = await createFarGoal({ userId: user.id });
    const path = outlinePath({ goalId: goal.id, skillId: first.skill.id });

    await expect(
      readBody({ response: await apiContext.get(path), schema: skillOutlineSchema }),
    ).resolves.toStrictEqual({ chapters: [], status: "available" });

    const started = await apiContext.post(`${path}/generations`);

    const body = await readBody({
      response: started,
      schema: skillOutlineGenerationSchema,
      status: ACCEPTED,
    });

    expect(body).toStrictEqual({ generationId: expect.any(String), status: "writing" });
    expect(started.headers().location).toBe(`/v1/generations/${body.generationId}`);

    // It reads as being written from the tap on, before its run gets to the subject.
    await expect(
      readBody({ response: await apiContext.get(path), schema: skillOutlineSchema }),
    ).resolves.toStrictEqual({ chapters: [], status: "writing" });

    // A second tap, while it's written or after its run failed, never counts again.
    const again = await apiContext.post(`${path}/generations`);
    expect(again.status()).toBe(ACCEPTED);

    await expect(
      prisma.usageRecord.findMany({
        select: { kind: true, targetId: true },
        where: { userId: user.id },
      }),
    ).resolves.toStrictEqual([{ kind: "outline", targetId: first.skill.id }]);

    await apiContext.dispose();
  });

  test("serves a topic another learner's outline already wrote, without writing it again", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "outline-ready",
    });

    const { first, goal } = await createFarGoal({ userId: user.id });
    const skillId = first.skill.id;

    const [chapter, lesson] = await Promise.all([
      libraryChapterFixture({ title: "Means and medians" }),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: first.course.id }),
      chapterSkillFixture({ chapterId: chapter.id, skillId }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
    ]);

    const path = outlinePath({ goalId: goal.id, skillId });

    await expect(
      readBody({
        response: await apiContext.post(`${path}/generations`),
        schema: skillOutlineGenerationSchema,
      }),
    ).resolves.toStrictEqual({ generationId: null, status: "ready" });

    await expect(
      readBody({ response: await apiContext.get(path), schema: skillOutlineSchema }),
    ).resolves.toStrictEqual({
      chapters: [{ chapterId: chapter.id, title: "Means and medians" }],
      status: "ready",
    });

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);
    await apiContext.dispose();
  });

  test("refuses a free learner's fourth topic of the day", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "outline-limit",
    });

    const { goal, topics } = await createFarGoal({ count: 4, userId: user.id });
    const statuses: number[] = [];

    for (const { skill } of topics) {
      const path = outlinePath({ goalId: goal.id, skillId: skill.id });
      // oxlint-disable-next-line no-await-in-loop -- each request counts the ones before it.
      const response = await apiContext.post(`${path}/generations`);
      statuses.push(response.status());
    }

    expect(statuses).toStrictEqual([ACCEPTED, ACCEPTED, ACCEPTED, PAYMENT_REQUIRED]);

    await apiContext.dispose();
  });
});

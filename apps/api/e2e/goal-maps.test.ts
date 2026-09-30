import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { chapterViewSchema } from "@zoonk/core/view-models/chapter/contract";
import { fieldMapViewSchema } from "@zoonk/core/view-models/map/contract";
import { type PlanItemStatus, prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { areaPracticeResponseSchema } from "../src/lib/openapi/schemas/learn-views";
import { createAuthenticatedApiContext } from "./helpers/auth";

const DAY_MS = 86_400_000;

/** A learn goal from a public course's Overview chapter: two one-skill lessons, one of them done. */
async function createCourseGoal({
  createdAt,
  statuses = ["done", "todo"],
  userId,
}: {
  createdAt?: Date;
  statuses?: PlanItemStatus[];
  userId: string;
}) {
  const organization = await organizationFixture();

  const [course, chapter, beginner, skills] = await Promise.all([
    courseFixture({ organizationId: organization.id, title: "Astronomy", visibility: "public" }),
    libraryChapterFixture({ level: "overview", title: "The night sky" }),
    libraryChapterFixture({ level: "beginner", title: "Orbits" }),
    Promise.all(["Stars", "Planets"].map((name) => skillFixture({ name }))),
  ]);

  const lessons = await Promise.all(
    skills.map((skill) => libraryLessonFixture({ title: `About ${skill.name}` })),
  );

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level: "overview" }),
    courseChapterFixture({ chapterId: beginner.id, courseId: course.id, level: "beginner" }),
    ...lessons.flatMap((lesson, position) => [
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skills[position]?.id ?? "" }),
      itemFixture({ skillId: skills[position]?.id ?? "" }),
    ]),
  ]);

  const goal = await goalFixture({
    createdAt,
    primaryCourseId: course.id,
    title: "Astronomy",
    userId,
  });

  const plan = await planFixture({ goalId: goal.id });

  await Promise.all(
    lessons.map((lesson, position) =>
      planItemFixture({
        chapterId: chapter.id,
        lessonId: lesson.id,
        planId: plan.id,
        position,
        status: statuses[position] ?? "todo",
      }),
    ),
  );

  return { chapter, course, goal, lessons, skills };
}

test.describe("Goal maps API", () => {
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
      anonymous.get(`/v1/goals/${goalId}/map`),
      anonymous.get(`/v1/goals/${goalId}/chapters/${randomUUID()}`),
      anonymous.post(`/v1/goals/${goalId}/refresh-practice`, { data: {} }),
      anonymous.post(`/v1/goals/${goalId}/next-level`),
    ]);

    expect(unauthorized.map((response) => response.status())).toStrictEqual([401, 401, 401, 401]);
    await anonymous.dispose();

    const [{ apiContext }, owner] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "maps-hidden" }),
      userFixture(),
    ]);

    const { chapter, goal } = await createCourseGoal({ userId: owner.id });

    const responses = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}/map`),
      apiContext.get(`/v1/goals/${goal.id}/chapters/${chapter.id}`),
      apiContext.post(`/v1/goals/${goal.id}/next-level`),
      apiContext.get(`/v1/goals/${goal.id}/chapters/not-a-uuid`),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([404, 404, 404, 400]);
    await apiContext.dispose();
  });

  test("returns the map of the field and a chapter's page", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({ baseURL, prefix: "maps" });
    const { chapter, course, goal, lessons } = await createCourseGoal({ userId: user.id });

    const mapResponse = await apiContext.get(`/v1/goals/${goal.id}/map`);
    expect(mapResponse.status()).toBe(200);

    const map = fieldMapViewSchema.parse(await mapResponse.json());

    expect(
      map.areas.map((area) => [area.chapterId, area.current, area.skills.length]),
    ).toStrictEqual([[chapter.id, true, 2]]);

    expect(map.course).toMatchObject({
      courseId: course.id,
      nextLevel: "beginner",
      planChapterCount: 1,
    });

    expect(map.next).toBeNull();

    const chapterResponse = await apiContext.get(`/v1/goals/${goal.id}/chapters/${chapter.id}`);
    expect(chapterResponse.status()).toBe(200);

    const page = chapterViewSchema.parse(await chapterResponse.json());

    expect(page.chapter).toMatchObject({ position: 1, title: "The night sky" });

    expect(page.lessons.map((lesson) => [lesson.lessonId, lesson.state])).toStrictEqual([
      [lessons[0]?.id, "done"],
      [lessons[1]?.id, "next"],
    ]);

    const outside = await libraryChapterFixture();
    const missing = await apiContext.get(`/v1/goals/${goal.id}/chapters/${outside.id}`);
    expect(missing.status()).toBe(404);

    await apiContext.dispose();
  });

  test("refreshes fading skills in today's session", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "maps-refresh",
    });

    // Past its first week, like a skill last reviewed 20 days ago: a first-week session asks
    // placement questions, which would already use the skill's only question.
    const { goal, skills } = await createCourseGoal({
      createdAt: new Date(Date.now() - 30 * DAY_MS),
      userId: user.id,
    });

    const path = `/v1/goals/${goal.id}/refresh-practice`;

    const nothing = await apiContext.post(path, { data: { timeZone: "UTC" } });
    expect(nothing.status()).toBe(422);

    await learnerSkillFixture({
      difficulty: 5,
      lastReviewedAt: new Date(Date.now() - 20 * DAY_MS),
      reps: 2,
      skillId: skills[0]?.id ?? "",
      stability: 2,
      state: "learning",
      userId: user.id,
    });

    const first = await apiContext.post(path, { data: { timeZone: "UTC" } });
    expect(first.status()).toBe(201);

    // Today's review of the fading skill opens first; a second tap returns the same block.
    const created = areaPracticeResponseSchema.parse(await first.json());
    expect(created.block.status).toBe("pending");

    const again = await apiContext.post(path, { data: { timeZone: "UTC" } });
    expect(areaPracticeResponseSchema.parse(await again.json()).block.id).toBe(created.block.id);

    await apiContext.dispose();
  });

  test("continues a finished plan at the course's next level", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "maps-next",
    });

    const unfinished = await createCourseGoal({ userId: user.id });

    const early = await apiContext.post(`/v1/goals/${unfinished.goal.id}/next-level`);
    expect(early.status()).toBe(409);

    const { course, goal } = await createCourseGoal({
      statuses: ["done", "done"],
      userId: user.id,
    });

    const mapResponse = await apiContext.get(`/v1/goals/${goal.id}/map`);
    const map = fieldMapViewSchema.parse(await mapResponse.json());

    expect(map.next?.nextLevel).toMatchObject({ courseId: course.id, level: "beginner" });

    const response = await apiContext.post(`/v1/goals/${goal.id}/next-level`);
    expect(response.status()).toBe(201);

    const body: unknown = await response.json();

    expect(body).toMatchObject({
      goal: { details: { courseLevel: "beginner" }, isActive: true, primaryCourseId: course.id },
    });

    const finished = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(finished.status).toBe("completed");

    await apiContext.dispose();
  });
});

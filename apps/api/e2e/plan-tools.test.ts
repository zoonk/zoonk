import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { buildSetupSkillIdentityKey } from "@zoonk/utils/identity-key";
import { planChangeResultSchema, planResponseSchema } from "../src/lib/openapi/schemas/plans";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

const LESSONS = 4;

/**
 * A planned goal over one Library chapter whose lessons use two tools. Tool names are unique per
 * test, so the setup lesson this test adds is its own.
 */
async function createToolGoal(userId: string) {
  const word = randomUUID().slice(0, 8);
  const tools = { python: `Python ${word}`, sheet: `Spreadsheet ${word} (Sheets or Excel)` };

  const [chapter, skill] = await Promise.all([
    libraryChapterFixture({
      title: `Data with code ${word}`,
      tools: [
        { essential: true, name: tools.sheet },
        { essential: false, name: tools.python },
      ],
    }),
    skillFixture({ name: `Clean a table ${word}` }),
  ]);

  const lessons = await Promise.all(
    Array.from({ length: LESSONS }, (_, index) =>
      libraryLessonFixture({ homeChapterId: chapter.id, title: `Lesson ${index + 1} ${word}` }),
    ),
  );

  await Promise.all(
    lessons.flatMap((lesson, position) => [
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ]),
  );

  const goal = await goalFixture({ dailyMinutes: 12, userId });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: "Clean real data", name: "Basics" }],
      skills: [
        {
          area: null,
          lessons: LESSONS,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        },
      ],
    },
    phases: [{ kind: "learn", milestone: "Clean real data", minutes: 0, name: "Basics" }],
  });

  // The items a built plan has: the card lists the tools of the chapters they come from.
  await Promise.all(
    lessons.map((lesson, position) =>
      planItemFixture({
        chapterId: chapter.id,
        lessonId: lesson.id,
        planId: plan.id,
        position,
        skillId: skill.id,
        titleSnapshot: lesson.title,
      }),
    ),
  );

  return { goal, tools };
}

/**
 * The setup lesson an earlier learner's choice wrote, found by the tool and the device. Tests
 * never call the model, so they start from one that exists.
 */
async function createSetupLesson({ system, tool }: { system: string; tool: string }) {
  const title = `Set up ${tool} on Windows`;

  const [skill, lesson] = await Promise.all([
    skillFixture({ identityKey: buildSetupSkillIdentityKey({ system, tool }), name: title }),
    libraryLessonFixture({ title }),
  ]);

  await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });

  return lesson;
}

test.describe("Plan tools API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post(`/v1/goals/${randomUUID()}/plan/tool-choices`, {
      data: { choice: "have", tools: ["Python"] },
    });

    expect(response.status()).toBe(401);
    await apiContext.dispose();
  });

  test("lists the plan's tools and saves the learner's answer for each", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "plan-tools",
    });

    const { goal, tools } = await createToolGoal(user.id);

    const before = await readBody({
      response: await apiContext.get(`/v1/goals/${goal.id}/plan`),
      schema: planResponseSchema,
    });

    expect(before.tools).toStrictEqual([
      { choice: null, essential: true, later: false, name: tools.sheet, system: null },
      { choice: null, essential: false, later: false, name: tools.python, system: null },
    ]);

    const setup = await createSetupLesson({ system: "windows", tool: tools.python });

    const added = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/plan/tool-choices`, {
        data: { choice: "setup", system: "windows", tools: [tools.python] },
      }),
      schema: planChangeResultSchema,
    });

    expect(added).toMatchObject({
      change: { canUndo: true, operations: [{ kind: "setTools" }, { kind: "addSkills" }] },
      status: "applied",
    });

    await expect
      .poll(async () =>
        prisma.planItem.count({ where: { lessonId: setup.id, plan: { goalId: goal.id } } }),
      )
      .toBe(1);

    const none = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/plan/tool-choices`, {
        data: { choice: "none", tools: [tools.sheet, tools.python] },
      }),
      schema: planChangeResultSchema,
    });

    expect(none.status).toBe("applied");

    const after = await readBody({
      response: await apiContext.get(`/v1/goals/${goal.id}/plan`),
      schema: planResponseSchema,
    });

    expect(after.tools.map((tool) => tool.choice)).toStrictEqual(["none", "none"]);

    await expect(
      prisma.planItem.count({ where: { lessonId: setup.id, plan: { goalId: goal.id } } }),
    ).resolves.toBe(0);

    await apiContext.dispose();
  });

  test("refuses tools the plan doesn't use and a setup without a device", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "plan-tools-invalid",
    });

    const { goal, tools } = await createToolGoal(user.id);

    const unknown = await apiContext.post(`/v1/goals/${goal.id}/plan/tool-choices`, {
      data: { choice: "have", tools: ["Photoshop"] },
    });

    expect(unknown.status()).toBe(422);

    await expect(unknown.json()).resolves.toMatchObject({
      error: { code: "PLAN_CHANGE_INVALID", details: { reason: "unknownTool" } },
    });

    const noDevice = await apiContext.post(`/v1/goals/${goal.id}/plan/tool-choices`, {
      data: { choice: "setup", tools: [tools.python] },
    });

    expect(noDevice.status()).toBe(400);

    const other = await createAuthenticatedApiContext({ baseURL, prefix: "plan-tools-other" });

    const foreign = await other.apiContext.post(`/v1/goals/${goal.id}/plan/tool-choices`, {
      data: { choice: "have", tools: [tools.python] },
    });

    expect(foreign.status()).toBe(404);
    await Promise.all([apiContext.dispose(), other.apiContext.dispose()]);
  });
});

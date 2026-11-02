import { randomUUID } from "node:crypto";
import { generateSetupLessonOutline } from "@zoonk/ai/tasks/curriculum/setup-lesson-outline";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { buildSetupSkillIdentityKey } from "@zoonk/utils/identity-key";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { setupLessonsWorkflow } from "./setup-lessons-workflow";

vi.mock("@zoonk/ai/tasks/curriculum/setup-lesson-outline", () => ({
  generateSetupLessonOutline: vi.fn(),
}));

const PROVENANCE = {
  generatedAt: new Date().toISOString(),
  latencyMs: 1,
  model: "openai/gpt-6-luna",
  promptVersion: "v-test",
  provider: "openai",
  requestedModel: "openai/gpt-6-luna",
  runId: "run-test",
  usage: {},
};

describe(setupLessonsWorkflow, () => {
  it("writes each tool's setup lesson in its own step, once", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const tools = [`Python ${randomUUID().slice(0, 8)}`, `Excel ${randomUUID().slice(0, 8)}`];

    vi.mocked(generateSetupLessonOutline).mockImplementation(async ({ tool }) => ({
      data: {
        canDo: `Open ${tool}`,
        description: `Install ${tool} and check it opens.`,
        estimatedMinutes: 4,
        skill: `Set up ${tool}`,
        title: `Set up ${tool} on Windows`,
      },
      provenance: PROVENANCE,
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    }));

    const writing = {
      goalId: goal.id,
      language: "en",
      system: "windows",
      tools: tools.map((name) => ({ name, ownerId: null })),
      userId: user.id,
    };

    const first = await start(setupLessonsWorkflow, [writing]);
    await expect(first.returnValue).resolves.toStrictEqual({ status: "written" });

    const again = await start(setupLessonsWorkflow, [writing]);
    await expect(again.returnValue).resolves.toStrictEqual({ status: "written" });

    expect(generateSetupLessonOutline).toHaveBeenCalledTimes(tools.length);

    const skills = await prisma.skill.findMany({
      include: { lessons: true },
      where: {
        identityKey: {
          in: tools.map((tool) => buildSetupSkillIdentityKey({ system: "windows", tool })),
        },
        language: "en",
      },
    });

    expect(skills.map((skill) => skill.lessons.length)).toStrictEqual([1, 1]);
  });
});

import { writeWritingPrompt } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { trackSystemEvent } from "@zoonk/core/analytics/server";
import { reserveWritingPromptSpend } from "@zoonk/core/library/items/writing-prompt-spend";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { getWorkflowMetadata } from "workflow";
import { getRun } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { taskResult } from "../_test-utils/recorded-outputs";
import { getStartMock } from "../_test-utils/start-mock";
import { ensureWritingPrompts, writingPromptWorkflow } from "./writing-prompt-workflow";

// The writer's provider is external. The prompt bank, guest spend, and step persistence use the local test database.
vi.mock("@zoonk/ai/tasks/items/write-writing-prompt", () => ({ writeWritingPrompt: vi.fn() }));

async function setup() {
  const [blueprint, user] = await Promise.all([
    examBlueprintFixture({
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "raw" },
          sections: [
            {
              day: null,
              kind: "written",
              minutes: 80,
              name: "Written section",
              questions: 1,
              tasks: [{ count: 1, description: "Policy question", key: "policy", lines: 30 }],
            },
          ],
          timeLimitMinutes: 80,
          totalQuestions: 1,
        },
        rules: [],
        subjects: [],
      },
    }),
    userFixture(),
  ]);

  vi.mocked(getWorkflowMetadata).mockReturnValue({
    ...getWorkflowMetadata(),
    workflowRunId: crypto.randomUUID(),
  });

  await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
  const goal = await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });

  return {
    blueprint,
    input: {
      count: 1,
      goalId: goal.id,
      taskKey: "policy",
      unit: "answer" as const,
      userId: user.id,
    },
  };
}

describe(writingPromptWorkflow, () => {
  it("shares the exam and task claim between advance preparation, a block and a mock", async () => {
    const { blueprint, input } = await setup();
    const token = `writing-prompt:${blueprint.id}:policy`;
    let launches = 0;

    getStartMock().mockImplementation(async (_workflow, _args, options) => {
      expect(options?.experimental_hook?.token).toBe(token);

      if (launches > 0) {
        throw new HookConflictError(token, "holder");
      }

      launches += 1;
      return { runId: "holder" } as never;
    });

    vi.mocked(getRun).mockReturnValue({
      exists: Promise.resolve(true),
      status: Promise.resolve("running"),
    } as never);

    const requests = await Promise.all([
      ensureWritingPrompts({ ...input, wait: "later" }),
      ensureWritingPrompts(input),
      ensureWritingPrompts({ ...input, count: 2 }),
    ]);

    expect(requests).toStrictEqual(
      Array.from({ length: 3 }, () => ({ runId: "holder", status: "writing" })),
    );

    expect(launches).toBe(1);

    const date = new Date("2040-11-20T12:00:00Z");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(date);

    try {
      vi.mocked(writeWritingPrompt).mockImplementationOnce(async ({ input: prompt }) =>
        taskResult({
          aspects: [{ criterionId: "reason", description: "Gives a reason", points: null }],
          assessedSkillIds: prompt.skills.map(({ id }) => id),
          context: null,
          criteria: [{ id: "reason", name: "Reasons", points: null }],
          keyPoints: ["Explain a reason"],
          question: "Explain the policy.",
          sampleOutline: "State the policy and give a reason.",
          title: "Policy reasons",
        }),
      );

      await expect(writingPromptWorkflow(input)).resolves.toStrictEqual({ status: "ready" });
      await expect(writingPromptWorkflow(input)).resolves.toStrictEqual({ status: "ready" });
      expect(writeWritingPrompt).toHaveBeenCalledOnce();

      await expect(
        prisma.guestSpendDay.findFirst({ where: { day: new Date("2040-11-20") } }),
      ).resolves.toMatchObject({ spentMicros: 10_000 });

      await expect(ensureWritingPrompts(input)).resolves.toStrictEqual({ status: "ready" });

      await expect(ensureWritingPrompts({ ...input, count: 2 })).resolves.toStrictEqual({
        runId: "holder",
        status: "writing",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("claims a specialty's prompt apart from another specialty's", async () => {
    const citation = { passage: "Each candidate picks one specialty.", sourceId: "notice" };

    const specialty = (name: string) => ({
      choiceGroup: "Specialty",
      citation,
      name,
      questions: null,
      topics: [`${name} basics`],
      weight: null,
    });

    const blueprint = await examBlueprintFixture({
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "raw" },
          sections: [
            {
              day: null,
              kind: "written",
              minutes: 80,
              name: "Written section",
              questions: 1,
              tasks: [
                {
                  count: 1,
                  description: "Case on the specialty",
                  key: "case",
                  subjects: ["Audit", "Systems"],
                },
              ],
            },
          ],
          timeLimitMinutes: 80,
          totalQuestions: 1,
        },
        rules: [],
        subjects: [specialty("Audit"), specialty("Systems")],
      },
    });

    const learner = async (option: string) => {
      const user = await userFixture();

      const goal = await goalFixture({
        examBlueprintId: blueprint.id,
        kind: "exam",
        userId: user.id,
      });

      await planFixture({
        goalId: goal.id,
        settings: { examChoices: [{ group: "Specialty", subjects: [option] }] },
      });

      return {
        count: 1,
        goalId: goal.id,
        taskKey: "case",
        unit: "answer" as const,
        userId: user.id,
      };
    };

    const tokens: (string | undefined)[] = [];

    getStartMock().mockImplementation(async (_workflow, _args, options) => {
      tokens.push(options?.experimental_hook?.token);
      return { runId: crypto.randomUUID() } as never;
    });

    await ensureWritingPrompts(await learner("Audit"));
    await ensureWritingPrompts(await learner("Systems"));
    await ensureWritingPrompts(await learner("Audit"));

    expect(tokens).toStrictEqual([
      `writing-prompt:${blueprint.id}:case:Audit`,
      `writing-prompt:${blueprint.id}:case:Systems`,
      `writing-prompt:${blueprint.id}:case:Audit`,
    ]);
  });

  it("replays the committed guest reservation after the workflow missed its acknowledgment", async () => {
    const { input } = await setup();
    const { workflowRunId: runId } = getWorkflowMetadata();
    const day = new Date("2040-11-21");

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(day);

    try {
      const reserve = () => reserveWritingPromptSpend({ count: 1, runId, userId: input.userId });
      await expect(Promise.all([reserve(), reserve()])).resolves.toStrictEqual([1, 1]);

      vi.setSystemTime(new Date("2040-11-22"));

      await expect(reserve()).resolves.toBe(1);

      await expect(prisma.guestSpendDay.findUnique({ where: { day } })).resolves.toMatchObject({
        spentMicros: 10_000,
      });

      await expect(
        prisma.guestSpendDay.findUnique({ where: { day: new Date("2040-11-22") } }),
      ).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a failed writer run once without a partial prompt", async () => {
    const { blueprint, input } = await setup();
    vi.mocked(writeWritingPrompt).mockRejectedValueOnce(new Error("Provider unavailable"));

    await expect(writingPromptWorkflow(input)).rejects.toThrow("Provider unavailable");

    expect(trackSystemEvent).toHaveBeenCalledExactlyOnceWith({
      name: "Generation Failed",
      properties: { content_kind: "essay", model: null, task: "write-writing-prompt" },
    });

    await expect(prisma.item.count({ where: { examBlueprintId: blueprint.id } })).resolves.toBe(0);
  });
});

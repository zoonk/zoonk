import { POST as startWriting } from "@/app/v1/essays/[blockId]/starts/route";
import { writeWritingPrompt } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { trackSystemEvent } from "@zoonk/core/analytics/server";
import { GUEST_DAILY_SPEND_BUDGET_MICROS } from "@zoonk/core/entitlements/limits";
import { loadWritingSupply } from "@zoonk/core/library/items/writing-prompt-pool";
import { reserveWritingPromptSpend } from "@zoonk/core/library/items/writing-prompt-spend";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { createHook, getWorkflowMetadata, sleep } from "workflow";
import { getRun } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { mockSession } from "../../../../../packages/core/src/_test-utils/mock-session";
import { mockHookConflict, workflowWriteMock } from "../../../mocks/workflow";
import { taskResult } from "../_test-utils/recorded-outputs";
import { getStartMock } from "../_test-utils/start-mock";
import { ensureWritingPrompts, writingPromptWorkflow } from "./writing-prompt-workflow";

// The writer's provider is external. The prompt bank, guest spend, and step persistence use the local test database.
vi.mock("@zoonk/ai/tasks/items/write-writing-prompt", () => ({ writeWritingPrompt: vi.fn() }));
vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

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

type Input = Parameters<typeof ensureWritingPrompts>[0];

async function writingRun(input: Input) {
  const supply = await loadWritingSupply(input);

  if (!supply) {
    throw new Error("Expected a writing prompt pool");
  }

  return { input, poolToken: supply.poolToken };
}

function mockPromptWriter() {
  vi.mocked(writeWritingPrompt).mockImplementation(async ({ input }) =>
    taskResult({
      aspects: [{ criterionId: "reason", description: "Gives a reason", points: null }],
      assessedSkillIds: input.skills.map(({ id }) => id),
      context: null,
      criteria: [{ id: "reason", name: "Reasons", points: null }],
      keyPoints: ["Explain a reason"],
      question: "Explain the policy.",
      sampleOutline: "State the policy and give a reason.",
      title: "Policy reasons",
    }),
  );
}

describe(writingPromptWorkflow, () => {
  it("shares the exam and task claim between advance preparation, a block and a mock", async () => {
    const { input } = await setup();
    let token: string | undefined;
    let launches = 0;

    getStartMock().mockImplementation(async (_workflow, _args, options) => {
      token ??= options?.experimental_hook?.token;
      expect(options?.experimental_hook?.token).toBe(token);

      if (token && launches > 0) {
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
      ensureWritingPrompts(input),
    ]);

    expect(requests).toStrictEqual(
      Array.from({ length: 3 }, () => ({ runId: "holder", status: "writing" })),
    );

    expect(launches).toBe(1);

    const date = new Date("2040-11-20T12:00:00Z");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(date);

    try {
      mockPromptWriter();

      await expect(writingPromptWorkflow(await writingRun(input))).resolves.toStrictEqual({
        status: "ready",
      });

      await expect(writingPromptWorkflow(await writingRun(input))).resolves.toStrictEqual({
        status: "ready",
      });

      expect(writeWritingPrompt).toHaveBeenCalledOnce();

      await expect(
        prisma.guestSpendDay.findFirst({ where: { day: new Date("2040-11-20") } }),
      ).resolves.toMatchObject({ spentMicros: 10_000 });

      await expect(ensureWritingPrompts(input)).resolves.toStrictEqual({ status: "ready" });

      getStartMock().mockResolvedValueOnce({ runId: "second" } as never);

      await expect(ensureWritingPrompts({ ...input, count: 2 })).resolves.toStrictEqual({
        runId: "second",
        status: "writing",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns a conflict without generating for a pending block whose task was removed", async () => {
    const {
      input: { goalId, userId },
    } = await setup();

    const session = await studySessionFixture({ goalId, userId });

    const block = await studySessionBlockFixture({
      kind: "produce",
      payload: { writing: { admissionId: null, draft: null, taskKey: "removed", unit: "answer" } },
      sessionId: session.id,
    });

    mockSession(userId);

    const response = await startWriting(
      new Request(`http://localhost/v1/essays/${block.id}/starts`, {
        body: "{}",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ blockId: block.id }) },
    );

    expect(response.status).toBe(409);
    expect(getStartMock()).not.toHaveBeenCalled();
    expect(writeWritingPrompt).not.toHaveBeenCalled();
    await expect(prisma.writingAdmission.count({ where: { userId } })).resolves.toBe(0);
  });

  it.each([false, true])(
    "shares one pool write when the first learner is refused: %s",
    async (refused) => {
      const { blueprint, input } = await setup();
      const otherUser = await userFixture();

      const otherGoal = await goalFixture({
        examBlueprintId: blueprint.id,
        kind: "exam",
        userId: otherUser.id,
      });

      const otherInput = { ...input, goalId: otherGoal.id, userId: otherUser.id };
      const privateRuns = new Map<string, string>();

      getStartMock().mockImplementation(async (_workflow, _args, options) => {
        const key = options?.experimental_hook?.token ?? "";
        const runId = privateRuns.get(key) ?? crypto.randomUUID();
        privateRuns.set(key, runId);
        return { runId } as never;
      });

      const [firstStart, secondStart, firstRun, secondRun] = await Promise.all([
        ensureWritingPrompts(input),
        ensureWritingPrompts(otherInput),
        writingRun(input),
        writingRun(otherInput),
      ]);

      expect(firstStart.status).toBe("writing");
      expect(secondStart.status).toBe("writing");
      expect(firstStart).not.toStrictEqual(secondStart);
      expect(firstRun.poolToken).toBe(secondRun.poolToken);

      const day = new Date(refused ? "2050-01-02" : "2050-01-01");
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(day);

      try {
        if (refused) {
          await prisma.guestSpendDay.create({
            data: { day, spentMicros: GUEST_DAILY_SPEND_BUDGET_MICROS },
          });
        }

        mockPromptWriter();
        const holder = getWorkflowMetadata().workflowRunId;
        const first = writingPromptWorkflow(firstRun);
        mockHookConflict({ returnValue: first, runId: holder });

        vi.mocked(getRun).mockReturnValue({
          exists: Promise.resolve(true),
          status: Promise.resolve("running"),
        } as never);

        vi.mocked(sleep).mockImplementationOnce(async () => {
          await first;
          mockHookConflict(null);
        });

        vi.mocked(getWorkflowMetadata).mockReturnValue({
          workflowRunId: crypto.randomUUID(),
        } as ReturnType<typeof getWorkflowMetadata>);

        await expect(Promise.all([first, writingPromptWorkflow(secondRun)])).resolves.toStrictEqual(
          [{ status: refused ? "signUpRequired" : "ready" }, { status: "ready" }],
        );

        expect(sleep).toHaveBeenCalledOnce();
        expect(new Set(vi.mocked(createHook).mock.calls.map(([arg]) => arg?.token)).size).toBe(1);
        expect(writeWritingPrompt).toHaveBeenCalledOnce();

        await expect(prisma.item.count({ where: { examBlueprintId: blueprint.id } })).resolves.toBe(
          1,
        );

        expect(
          workflowWriteMock.mock.calls
            .flat()
            .filter((event: string) => event.includes('"step":"signUpRequired"')),
        ).toHaveLength(refused ? 1 : 0);
      } finally {
        vi.useRealTimers();
      }
    },
  );

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

    const learner = async (option: string | null) => {
      const user = await userFixture();

      const goal = await goalFixture({
        examBlueprintId: blueprint.id,
        kind: "exam",
        userId: user.id,
      });

      await planFixture({
        goalId: goal.id,
        settings: { examChoices: option ? [{ group: "Specialty", subjects: [option] }] : [] },
      });

      return {
        count: 1,
        goalId: goal.id,
        taskKey: "case",
        unit: "answer" as const,
        userId: user.id,
      };
    };

    const audit = await learner("Audit");

    const [auditRun, systemRun, otherAuditRun, drillRun, otherDrillRun] = await Promise.all([
      writingRun(audit),
      learner("Systems").then(writingRun),
      learner("Audit").then(writingRun),
      writingRun({ ...audit, skillId: crypto.randomUUID(), unit: "drill" }),
      writingRun({ ...audit, skillId: crypto.randomUUID(), unit: "drill" }),
    ]);

    await expect(ensureWritingPrompts(await learner(null))).resolves.toStrictEqual({
      status: "ready",
    });

    expect(getStartMock()).not.toHaveBeenCalled();

    expect(otherAuditRun.poolToken).toBe(auditRun.poolToken);

    expect(
      new Set([auditRun, systemRun, drillRun, otherDrillRun].map(({ poolToken }) => poolToken))
        .size,
    ).toBe(4);
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

    await expect(writingPromptWorkflow(await writingRun(input))).rejects.toThrow(
      "Provider unavailable",
    );

    expect(trackSystemEvent).toHaveBeenCalledExactlyOnceWith({
      name: "Generation Failed",
      properties: { content_kind: "essay", model: null, task: "write-writing-prompt" },
    });

    await expect(prisma.item.count({ where: { examBlueprintId: blueprint.id } })).resolves.toBe(0);
  });
});

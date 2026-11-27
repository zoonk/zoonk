import { writeWritingPrompt } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { sessionGoalFixture } from "../../sessions/_test-utils/session-goal";
import { writingPromptRunFixture } from "./_test-utils/writing-prompt-run";
import { loadSessionProduce } from "./_utils/load-produce";
import { findWritingPrompts } from "./writing-supply";

// Substitute the model boundary, while the item write and prompt picker use the test database.
vi.mock("@zoonk/ai/tasks/items/write-writing-prompt", () => ({ writeWritingPrompt: vi.fn() }));

const structure = {
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
        minutes: 210,
        name: "Written test",
        questions: 2,
        tasks: [
          { count: 1, description: "Short answer", key: "short", lines: 20, points: 70 },
          { count: 1, description: "Long answer", key: "long", lines: 40, points: 30 },
        ],
      },
    ],
    timeLimitMinutes: 210,
    totalQuestions: 2,
  },
  rules: [],
  subjects: [],
};

describe("writing with an empty prompt bank", () => {
  it("reserves a private class test's short written response without an essay item", async () => {
    const user = await userFixture();

    const blueprint = await examBlueprintFixture({
      ownerId: user.id,
      structure: {
        formats: [
          {
            citation: { passage: "Write a short answer", sourceId: "worksheet" },
            description: "Explain your conclusion",
            kind: "shortAnswer",
            options: null,
          },
        ],
        mock: null,
        rules: [],
        subjects: [],
      },
      visibility: "private",
    });

    const { goal } = await sessionGoalFixture({
      goal: { examBlueprintId: blueprint.id, kind: "exam" },
      userId: user.id,
    });

    await expect(
      loadSessionProduce({
        goal,
        planSettings: null,
        today: new Date("2026-11-20"),
        userId: user.id,
      }),
    ).resolves.toMatchObject({
      minutes: 8,
      pacing: "practice",
      taskKey: "class-short-answer",
      title: "Explain your conclusion",
    });
  });

  it.each([true, false])(
    "plans a whole answer when the blueprint arrived first: %s",
    async (blueprintFirst) => {
      const user = await userFixture();
      const initial = blueprintFirst ? await examBlueprintFixture({ structure }) : null;

      const { goal } = await sessionGoalFixture({
        goal: { dailyMinutes: 15, examBlueprintId: initial?.id ?? null, kind: "exam" },
        userId: user.id,
      });

      const blueprint = initial ?? (await examBlueprintFixture({ structure }));

      const linked = initial
        ? goal
        : await prisma.goal.update({
            data: { examBlueprintId: blueprint.id },
            where: { id: goal.id },
          });

      const request = { count: 1, taskKey: "short", unit: "answer" as const };

      await expect(
        findWritingPrompts({ goalId: goal.id, requests: [request], tx: prisma, userId: user.id }),
      ).resolves.toStrictEqual({ requests: [request], status: "missing" });

      await expect(
        loadSessionProduce({
          goal: linked,
          planSettings: null,
          today: new Date("2026-11-20"),
          userId: user.id,
        }),
      ).resolves.toMatchObject({ minutes: 70, taskKey: "short", unit: "answer" });

      const writer = vi.mocked(writeWritingPrompt);
      writer.mockClear();
      writer.mockRejectedValueOnce(new Error("Writer temporarily unavailable"));

      writer.mockImplementationOnce(async ({ input }) => ({
        data: {
          aspects: [
            {
              criterionId: "answer",
              description: "Explain one cause",
              kind: "definitePoint",
              points: null,
              steps: null,
            },
          ],
          assessedSkillIds: input.skills.map(({ id }) => id),
          context: null,
          criteria: [{ id: "answer", name: "Explain the cause", points: null }],
          keyPoints: ["Explain one cause"],
          question: "Explain what happened.",
          sampleOutline: "State the cause, then explain it.",
          title: "Explain what happened",
        },
        provenance: {
          generatedAt: new Date().toISOString(),
          latencyMs: 1,
          model: "fixture",
          promptVersion: "fixture",
          provider: "fixture",
          requestedModel: "fixture",
          runId: "fixture",
          usage: {},
        },
        systemPrompt: "",
        usage: {
          inputTokenDetails: {
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
            noCacheTokens: 0,
          },
          inputTokens: 0,
          outputTokenDetails: { reasoningTokens: undefined, textTokens: 0 },
          outputTokens: 0,
          totalTokens: 0,
        },
        userPrompt: "",
      }));

      const { itemId, write } = await writingPromptRunFixture({
        ...request,
        goalId: goal.id,
        userId: user.id,
      });

      await expect(write()).rejects.toThrow("Writer temporarily unavailable");
      await expect(prisma.item.findUnique({ where: { id: itemId } })).resolves.toBeNull();
      await write();
      await write();
      expect(writer).toHaveBeenCalledTimes(2);

      await expect(prisma.item.findUnique({ where: { id: itemId } })).resolves.toMatchObject({
        content: { writing: { lines: 20, points: 70, taskKey: "short" } },
      });

      await expect(
        findWritingPrompts({ goalId: goal.id, requests: [request], tx: prisma, userId: user.id }),
      ).resolves.toStrictEqual({ itemIds: [itemId], status: "ready" });
    },
  );
});

import { suggestProfileTools } from "@zoonk/ai/tasks/profile/suggest-tools";
import { getUsageRule } from "@zoonk/core/entitlements/limits";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { boundaries } from "../../../mocks/boundaries";
import { backgroundTaskWorkflow } from "./background-task-workflow";

async function owedTools(userId: string) {
  const input = { language: "pt" } as const;

  const row = await prisma.followUp.create({
    data: { input, key: "profile", kind: "suggestProfileTools", userId },
  });

  return { ...row, input, kind: "suggestProfileTools" as const };
}

const model = boundaries["@zoonk/ai/tasks/profile/suggest-tools"].suggestProfileTools;

describe("the profile tools workflow", () => {
  it("uses the current profile and active goals, stores the model's list, and completes its ask", async () => {
    const { id: userId } = await userFixture();

    const [task] = await Promise.all([
      owedTools(userId),
      learningProfileFixture({ homeCountry: "BR", userId }),
      goalFixture({ title: "Learn triage", userId }),
      goalFixture({ status: "paused", title: "Learn ceramics", userId }),
      memoryFactFixture({
        profileAnswer: { job: "nurse", status: "workAndStudy" },
        sourceRef: { id: "work", kind: "profile" },
        userId,
      }),
      memoryFactFixture({
        profileAnswer: { field: "health", subject: "Nursing" },
        sourceRef: { id: "studies", kind: "profile" },
        userId,
      }),
    ]);

    model.mockResolvedValue({ data: { tools: ["Tasy", "Whitebook", "x".repeat(121)] } });
    await backgroundTaskWorkflow(task);
    await backgroundTaskWorkflow(task);

    expect(vi.mocked(suggestProfileTools)).toHaveBeenCalledExactlyOnceWith({
      analytics: { contentScope: "personal", distinctId: userId },
      country: "BR",
      goals: ["Learn triage"],
      job: "nurse",
      language: "pt",
      studies: ["Saúde: Nursing"],
      workStatus: "workAndStudy",
    });

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId } }),
    ).resolves.toMatchObject({ suggestedTools: ["Tasy", "Whitebook"] });

    await expect(prisma.usageRecord.count({ where: { kind: "assist", userId } })).resolves.toBe(1);

    await expect(prisma.followUp.findUnique({ where: { id: task.id } })).resolves.toBeNull();
  });

  it("discards an older result when the learner changes an answer during generation", async () => {
    const { id: userId } = await userFixture();

    const [task] = await Promise.all([
      owedTools(userId),
      learningProfileFixture({ suggestedTools: ["Google Drive"], userId }),
    ]);

    model.mockImplementation(async () => {
      await prisma.followUp.update({ data: { revision: 1 }, where: { id: task.id } });
      return { data: { tools: ["Old suggestion"] } };
    });

    await backgroundTaskWorkflow(task);

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId } }),
    ).resolves.toMatchObject({ suggestedTools: ["Google Drive"] });

    await expect(prisma.followUp.findUnique({ where: { id: task.id } })).resolves.toMatchObject({
      revision: 1,
    });
  });

  it("keeps the previous list without generating when the assist allowance is exhausted", async () => {
    const { id: userId } = await userFixture();

    const [task] = await Promise.all([
      owedTools(userId),
      learningProfileFixture({ suggestedTools: ["Google Drive"], userId }),
      usageRecordsFixture({
        count: getUsageRule({ kind: "assist", tier: "free" }).day ?? 0,
        kind: "assist",
        userId,
      }),
    ]);

    model.mockResolvedValue({ data: { tools: ["Tasy"] } });
    await backgroundTaskWorkflow(task);

    expect(model).not.toHaveBeenCalled();

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId } }),
    ).resolves.toMatchObject({ suggestedTools: ["Google Drive"] });

    await expect(prisma.followUp.findUnique({ where: { id: task.id } })).resolves.toBeNull();
  });

  it("clears pending work without calling the model when memory is off", async () => {
    const { id: userId } = await userFixture();

    const [task] = await Promise.all([
      owedTools(userId),
      learningProfileFixture({ memoryEnabled: false, userId }),
    ]);

    await backgroundTaskWorkflow(task);
    expect(model).not.toHaveBeenCalled();
    await expect(prisma.followUp.findUnique({ where: { id: task.id } })).resolves.toBeNull();
  });

  it("keeps the previous suggestions and records an exhausted generation failure", async () => {
    const { id: userId } = await userFixture();

    const [task] = await Promise.all([
      owedTools(userId),
      learningProfileFixture({ suggestedTools: ["Google Drive"], userId }),
    ]);

    model.mockRejectedValue(new Error("Model unavailable"));
    await backgroundTaskWorkflow(task);
    await backgroundTaskWorkflow(task);

    expect(model).toHaveBeenCalledOnce();

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId } }),
    ).resolves.toMatchObject({ suggestedTools: ["Google Drive"] });

    await expect(prisma.followUp.findUnique({ where: { id: task.id } })).resolves.toMatchObject({
      failedAt: expect.any(Date),
    });
  });
});

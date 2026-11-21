import { suggestProfileTools } from "@zoonk/ai/tasks/profile/suggest-tools";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { listFollowUps } from "../../follow-ups/follow-up-rows";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { writeProfileToolSuggestions } from "./suggest-profile-tools";

// Inject a model failure after the real allowance claim without calling the provider.
vi.mock("@zoonk/ai/tasks/profile/suggest-tools", () => ({ suggestProfileTools: vi.fn() }));

async function askForTools(userId: string) {
  await oweFollowUps({
    followUps: [{ input: { language: "en" }, kind: "suggestProfileTools" }],
    userId,
  });

  const [task] = await listFollowUps(userId);

  if (task?.kind !== "suggestProfileTools") {
    throw new Error("Expected an owed profile tool suggestion");
  }

  return task;
}

function mockTools(tools: string[]) {
  vi.mocked(suggestProfileTools).mockResolvedValue({
    data: { tools },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6-luna",
      promptVersion: "test",
      provider: "test",
      requestedModel: "openai/gpt-6-luna",
      runId: crypto.randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

describe(writeProfileToolSuggestions, () => {
  it("retries a failed suggestion using the learner's last assist only once", async () => {
    const { id: userId } = await userFixture();
    const where = { kind: "assist", userId } as const;

    const [task] = await Promise.all([
      askForTools(userId),
      usageRecordsFixture({ ...where, count: 99 }),
    ]);

    vi.mocked(suggestProfileTools).mockRejectedValueOnce(new Error("model unavailable"));
    await expect(writeProfileToolSuggestions(task)).rejects.toThrow("model unavailable");
    await expect(prisma.usageRecord.count({ where })).resolves.toBe(100);

    mockTools(["Figma"]);
    await expect(writeProfileToolSuggestions(task)).resolves.toStrictEqual(["Figma"]);
    await expect(prisma.usageRecord.count({ where })).resolves.toBe(100);
  });

  it("charges a new revision of the same ask separately", async () => {
    const { id: userId } = await userFixture();
    const first = await askForTools(userId);
    mockTools(["Figma"]);
    await expect(writeProfileToolSuggestions(first)).resolves.toStrictEqual(["Figma"]);

    const next = await askForTools(userId);
    expect(next).toMatchObject({ id: first.id, revision: first.revision + 1 });

    mockTools(["Canva"]);
    await expect(writeProfileToolSuggestions(next)).resolves.toStrictEqual(["Canva"]);
    await expect(prisma.usageRecord.count({ where: { kind: "assist", userId } })).resolves.toBe(2);
  });
});

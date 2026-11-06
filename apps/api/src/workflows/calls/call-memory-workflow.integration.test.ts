import { extractMemoryFacts } from "@zoonk/ai/tasks/memory/extraction";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { startOnce } from "../_shared/run-token";
import { callMemoryWorkflow, getCallMemoryToken } from "./call-memory-workflow";

vi.mock("@zoonk/ai/tasks/memory/extraction", () => ({ extractMemoryFacts: vi.fn() }));

const NOTHING_TO_REMEMBER = {
  data: { facts: [] },
  provenance: {
    generatedAt: new Date().toISOString(),
    latencyMs: 1,
    model: "openai/gpt-6-luna",
    promptVersion: "v-test",
    provider: "openai",
    requestedModel: "openai/gpt-6-luna",
    runId: "run-test",
    usage: {},
  },
  systemPrompt: "",
  usage: undefined as never,
  userPrompt: "",
};

async function settledCall() {
  const user = await userFixture();

  const conversation = await prisma.languageConversation.create({
    data: {
      kind: "practice",
      language: "pt",
      level: "A2",
      minutes: 2,
      scenario: RENTING_SCENARIO,
      targetLanguage: "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId: user.id,
    },
  });

  return {
    conversationId: conversation.id,
    timeZone: "UTC",
    turns: [
      { speaker: "character" as const, text: "Hi! Are you calling about the apartment?" },
      { speaker: "learner" as const, text: "Yes. I move to Toronto next month." },
    ],
    userId: user.id,
  };
}

describe(callMemoryWorkflow, () => {
  it("reads a call once when it's asked to twice, the second start answering with the first run", async () => {
    const call = await settledCall();
    const release = Promise.withResolvers<null>();

    vi.mocked(extractMemoryFacts)
      .mockReset()
      .mockImplementationOnce(async () => {
        await release.promise;
        return NOTHING_TO_REMEMBER;
      })
      .mockResolvedValue(NOTHING_TO_REMEMBER);

    const startMemory = () =>
      startOnce(callMemoryWorkflow, [call], getCallMemoryToken(call.conversationId));

    const first = await startMemory();

    await vi.waitFor(() => expect(extractMemoryFacts).toHaveBeenCalledOnce(), {
      interval: 100,
      timeout: 30_000,
    });

    await expect(startMemory()).resolves.toBe(first);

    release.resolve(null);
    await getRun(first).returnValue;

    expect(extractMemoryFacts).toHaveBeenCalledOnce();
  });
});

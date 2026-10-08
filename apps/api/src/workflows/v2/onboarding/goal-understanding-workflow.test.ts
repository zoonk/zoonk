import { randomUUID } from "node:crypto";
import { type CourseIntent, classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { type GoalUnderstanding, understandGoal } from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { prisma } from "@zoonk/db";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { mockHookConflict } from "../../../../mocks/workflow";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { taskResult } from "../_test-utils/recorded-outputs";
import { levelTestBankWorkflow } from "../language/level-test-bank-workflow";
import { goalUnderstandingWorkflow } from "./goal-understanding-workflow";

vi.mock("workflow/api", () => ({ start: vi.fn(() => Promise.resolve({ runId: "started-run" })) }));

// Model calls are external: the understanding and the unsafe-intent classifier.
vi.mock("@zoonk/ai/tasks/v2/goals/understand-goal", () => ({ understandGoal: vi.fn() }));
vi.mock("@zoonk/ai/tasks/courses/intent", () => ({ classifyCourseIntent: vi.fn() }));

const LEARN: GoalUnderstanding = {
  dailyMinutes: 20,
  followUps: [],
  goals: [{ kind: "learn", subject: "Welding", title: "Learn to weld" }],
  route: "goals",
};

function mockModels({
  intent = "learn",
  understanding = LEARN,
}: { intent?: CourseIntent; understanding?: GoalUnderstanding } = {}) {
  vi.mocked(understandGoal).mockResolvedValue(taskResult(understanding, "openai/gpt-6-luna"));
  vi.mocked(classifyCourseIntent).mockResolvedValue(taskResult({ intent }));
}

async function createDraft(
  attrs: { prompt?: string; status?: "failed" | "understanding" | "understood" } = {},
) {
  const user = await userFixture();

  return onboardingDraftFixture({
    prompt: attrs.prompt ?? `learn to weld ${randomUUID()}`,
    status: attrs.status ?? "understanding",
    timeZone: "America/Sao_Paulo",
    userId: user.id,
  });
}

describe(goalUnderstandingWorkflow, () => {
  it("reads the words, keeps the card on the draft and says each step", async () => {
    mockModels();
    const draft = await createDraft();

    await expect(goalUnderstandingWorkflow({ draftId: draft.id })).resolves.toStrictEqual({
      draftId: draft.id,
      status: "understood",
    });

    expect(understandGoal).toHaveBeenCalledWith(
      expect.objectContaining({ goal: draft.prompt, language: "en" }),
    );

    const stored = await prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });

    expect(stored).toMatchObject({
      runId: "test-run-id",
      status: "understood",
      understanding: {
        goals: [
          {
            draft: {
              details: { answered: ["schedule"], onboardingId: draft.id, subject: "Welding" },
              kind: "learn",
              title: "Learn to weld",
            },
          },
        ],
        schedule: { dailyMinutes: 20 },
        status: "goals",
      },
    });

    const cached = await prisma.goalUnderstanding.findUnique({
      where: {
        languageNormalizedPrompt: {
          language: "en",
          normalizedPrompt: normalizeString(draft.prompt),
        },
      },
    });

    expect(cached).toMatchObject({ model: "openai/gpt-6-luna", result: LEARN });

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: draft.id, status: "started", step: "readGoal" },
      { entityId: draft.id, status: "started", step: "findExamDates" },
      { entityId: draft.id, status: "completed", step: "understandingReady" },
    ]);

    // A learn goal has no level test to write.
    expect(start).not.toHaveBeenCalled();
  });

  it("starts writing a language goal's level test once the card is ready", async () => {
    mockModels({
      understanding: {
        followUps: [],
        goals: [
          { kind: "language", subject: "Japanese", targetLanguage: "ja", title: "Speak Japanese" },
        ],
        route: "goals",
      },
    });

    const draft = await createDraft();

    await goalUnderstandingWorkflow({ draftId: draft.id });

    expect(start).toHaveBeenCalledExactlyOnceWith(levelTestBankWorkflow, [
      { analytics: { distinctId: draft.userId }, pair: { language: "en", targetLanguage: "ja" } },
    ]);

    expect(getStreamedEvents().at(-1)).toStrictEqual({
      entityId: draft.id,
      status: "completed",
      step: "understandingReady",
    });
  });

  it("keeps the card when the level test can't start", async () => {
    vi.mocked(start).mockRejectedValueOnce(new Error("The queue is down"));

    mockModels({
      understanding: {
        followUps: [],
        goals: [
          { kind: "language", subject: "Korean", targetLanguage: "ko", title: "Learn Korean" },
        ],
        route: "goals",
      },
    });

    const draft = await createDraft();

    await expect(goalUnderstandingWorkflow({ draftId: draft.id })).resolves.toMatchObject({
      status: "understood",
    });

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({ status: "understood" });
  });

  it("declines what the unsafe-intent classifier declines", async () => {
    mockModels({ intent: "unsafe" });
    const draft = await createDraft();

    await goalUnderstandingWorkflow({ draftId: draft.id });

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({ status: "understood", understanding: { status: "unsafe" } });
  });

  it("marks the draft failed and says so when the words can't be read", async () => {
    vi.mocked(understandGoal).mockRejectedValue(new Error("The model is down"));
    vi.mocked(classifyCourseIntent).mockResolvedValue(taskResult({ intent: "learn" as const }));

    const draft = await createDraft();

    await expect(goalUnderstandingWorkflow({ draftId: draft.id })).rejects.toThrow(
      "The model is down",
    );

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({ runId: "test-run-id", status: "failed", understanding: null });

    expect(getStreamedEvents()).toContainEqual({
      entityId: draft.id,
      reason: "aiGenerationFailed",
      status: "error",
      step: "workflowError",
    });
  });

  it("doesn't read a draft that's already understood again", async () => {
    mockModels();
    const draft = await createDraft({ status: "understood" });

    await expect(goalUnderstandingWorkflow({ draftId: draft.id })).resolves.toMatchObject({
      status: "understood",
    });

    expect(understandGoal).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: draft.id, status: "completed", step: "understandingReady" },
    ]);
  });

  it("joins the run already reading the draft", async () => {
    mockModels();
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "running-run" });
    const draft = await createDraft();

    await expect(goalUnderstandingWorkflow({ draftId: draft.id })).resolves.toStrictEqual({
      draftId: draft.id,
      status: "joined",
    });

    expect(understandGoal).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: "running-run", status: "started", step: "joinRunningUnderstanding" },
    ]);
  });

  it("says a draft that's gone was not found", async () => {
    const draftId = randomUUID();

    await expect(goalUnderstandingWorkflow({ draftId })).resolves.toStrictEqual({
      draftId,
      status: "missing",
    });

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: draftId, reason: "notFound", status: "error", step: "workflowError" },
    ]);
  });
});

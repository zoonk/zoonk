import { randomUUID } from "node:crypto";
import { type CourseIntent, classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { findExamDate } from "@zoonk/ai/tasks/goals/find-exam-date";
import { type GoalUnderstanding, understandGoal } from "@zoonk/ai/tasks/goals/understand-goal";
import { decideExamIdentity } from "@zoonk/ai/tasks/research/exam-identity-decision";
import { buildExamIdentityKey } from "@zoonk/core/library/exams/identity";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { mockHookConflict } from "../../../mocks/workflow";
import { getStreamedEvents } from "../_test-utils/parse-stream-events";
import { taskResult } from "../_test-utils/recorded-outputs";
import { levelTestBankWorkflow } from "../language/level-test-bank-workflow";
import { goalUnderstandingWorkflow } from "./goal-understanding-workflow";

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
  attrs: {
    prompt?: string;
    status?: "failed" | "understanding" | "understood";
    userId?: string;
  } = {},
) {
  const user = attrs.userId ? { id: attrs.userId } : await userFixture();

  return onboardingDraftFixture({
    prompt: attrs.prompt ?? `learn to weld ${randomUUID()}`,
    status: attrs.status ?? "understanding",
    timeZone: "America/Sao_Paulo",
    userId: user.id,
  });
}

async function storedExam(examName: string) {
  const source = await sourceFixture({ title: "Official notice" });
  const citation = { passage: "The exam takes place on", sourceId: source.id };

  const blueprint = await examBlueprintFixture({
    edition: {
      check: null,
      citations: [],
      dates: [{ citation, date: "2099-11-08", kind: "exam", label: "Day 1", startTime: null }],
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      timeZone: null,
      year: 2099,
    },
    identityKey: buildExamIdentityKey({ name: examName, ownerId: null, role: null }),
    name: examName,
  });

  return { blueprint, source };
}

function readCard(draftId: string) {
  return prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draftId } });
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
        userLanguagePrompt: {
          language: "en",
          normalizedPrompt: normalizeString(draft.prompt),
          userId: draft.userId,
        },
      },
    });

    expect(cached).toMatchObject({ model: "openai/gpt-6-luna", result: LEARN });

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: draft.id, status: "started", step: "readGoal" },
      { entityId: draft.id, status: "completed", step: "understandingReady" },
    ]);

    expect(start).not.toHaveBeenCalled();
  });

  it("checks the exam's dates only for words that name an exam", async () => {
    mockModels({
      understanding: {
        followUps: [],
        goals: [
          {
            examName: "IELTS",
            kind: "exam",
            subject: "English",
            targetDate: "2027-05-03",
            title: "Pass the IELTS",
          },
        ],
        route: "goals",
      },
    });

    const draft = await createDraft({ prompt: `pass the IELTS ${randomUUID()}` });

    await goalUnderstandingWorkflow({ draftId: draft.id });

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: draft.id, status: "started", step: "readGoal" },
      { entityId: draft.id, status: "started", step: "findExamDates" },
      { entityId: draft.id, status: "completed", step: "understandingReady" },
    ]);

    expect(findExamDate).not.toHaveBeenCalled();
  });

  it("reuses words read today without a model call, keeps that reading's age and gives the exam its stored days", async () => {
    const user = await userFixture();
    const examName = `Test Exam ${randomUUID()}`;
    const prompt = `pass the exam in 2099 ${randomUUID()}`;

    const [{ blueprint, source }, kept] = await Promise.all([
      storedExam(examName),
      goalUnderstandingFixture({
        goal: prompt,
        result: {
          followUps: [],
          goals: [{ examName, examYear: 2099, kind: "exam", subject: examName, title: "Pass it" }],
          route: "goals",
        },
        userId: user.id,
      }),
    ]);

    const draft = await createDraft({ prompt, userId: user.id });

    await expect(goalUnderstandingWorkflow({ draftId: draft.id })).resolves.toMatchObject({
      status: "understood",
    });

    expect(understandGoal).not.toHaveBeenCalled();
    expect(classifyCourseIntent).not.toHaveBeenCalled();
    expect(decideExamIdentity).not.toHaveBeenCalled();
    expect(findExamDate).not.toHaveBeenCalled();

    await expect(readCard(draft.id)).resolves.toMatchObject({
      status: "understood",
      understanding: {
        goals: [
          {
            draft: { examBlueprintId: blueprint.id },
            examDates: [
              {
                date: "2099-11-08",
                estimated: false,
                label: "Day 1",
                registrationClosed: false,
                source: { title: "Official notice", url: source.url },
              },
            ],
          },
        ],
      },
    });

    await expect(
      prisma.goalUnderstanding.findUniqueOrThrow({ where: { id: kept.id } }),
    ).resolves.toMatchObject({ generatedAt: kept.generatedAt, model: "test" });

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: draft.id, status: "started", step: "readGoal" },
      { entityId: draft.id, status: "started", step: "findExamDates" },
      { entityId: draft.id, status: "completed", step: "understandingReady" },
    ]);
  });

  it("completes the card without dates when the exam's date search fails", async () => {
    vi.mocked(findExamDate).mockRejectedValue(new Error("The search is down"));

    mockModels({
      understanding: {
        followUps: [],
        goals: [
          {
            examDay: "official",
            examName: `Unstored Exam ${randomUUID()}`,
            kind: "exam",
            subject: "Law",
            title: "Pass the bar",
          },
        ],
        route: "goals",
      },
    });

    const draft = await createDraft({ prompt: `pass the bar ${randomUUID()}` });

    await expect(goalUnderstandingWorkflow({ draftId: draft.id })).resolves.toMatchObject({
      status: "understood",
    });

    expect(findExamDate).toHaveBeenCalledOnce();

    await expect(readCard(draft.id)).resolves.toMatchObject({
      status: "understood",
      understanding: { goals: [{ draft: { title: "Pass the bar" }, examDates: [] }] },
    });

    expect(getStreamedEvents().at(-1)).toStrictEqual({
      entityId: draft.id,
      status: "completed",
      step: "understandingReady",
    });
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

  it("declines what the unsafe-intent classifier declines, and keeps that for the same words", async () => {
    mockModels({ intent: "unsafe" });
    const draft = await createDraft();

    await goalUnderstandingWorkflow({ draftId: draft.id });

    await expect(readCard(draft.id)).resolves.toMatchObject({
      status: "understood",
      understanding: { status: "unsafe" },
    });

    await expect(
      prisma.goalUnderstanding.findUniqueOrThrow({
        where: {
          userLanguagePrompt: {
            language: "en",
            normalizedPrompt: normalizeString(draft.prompt),
            userId: draft.userId,
          },
        },
      }),
    ).resolves.toMatchObject({ result: { route: "unsafe" } });
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

import { randomUUID } from "node:crypto";
import { get } from "@vercel/blob";
import { classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { findExamDate } from "@zoonk/ai/tasks/goals/find-exam-date";
import { understandGoal } from "@zoonk/ai/tasks/goals/understand-goal";
import { transcribeMaterial } from "@zoonk/ai/tasks/material/transcribe";
import { decideExamIdentity } from "@zoonk/ai/tasks/research/exam-identity-decision";
import { understandGoalWords } from "@zoonk/core/view-models/onboarding/understanding-run";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { taskResult } from "../_test-utils/recorded-outputs";
import { goalUnderstandingWorkflow } from "./goal-understanding-workflow";

vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  get: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/material/transcribe", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  transcribeMaterial: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/goals/understand-goal", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  understandGoal: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/intent", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  classifyCourseIntent: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/goals/find-exam-date", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findExamDate: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/research/exam-identity-decision", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  decideExamIdentity: vi.fn(),
}));

describe(goalUnderstandingWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries each model call on its own, and completes the card without dates once the date search gives up", async () => {
    vi.mocked(decideExamIdentity).mockResolvedValue(null);
    vi.mocked(classifyCourseIntent).mockResolvedValue(taskResult({ intent: "learn" as const }));
    vi.mocked(findExamDate).mockRejectedValue(new Error("The search is down"));

    vi.mocked(understandGoal)
      .mockRejectedValueOnce(new Error("The model is down"))
      .mockResolvedValue(
        taskResult({
          followUps: [],
          goals: [
            {
              countryDependent: false,
              examDay: "official",
              examName: `Unstored Exam ${randomUUID()}`,
              kind: "exam",
              subject: "Law",
              title: "Pass the bar",
            },
          ],
          route: "goals",
        }),
      );

    const user = await userFixture();

    const draft = await onboardingDraftFixture({
      prompt: `pass the bar ${randomUUID()}`,
      status: "understanding",
      userId: user.id,
    });

    const run = await start(goalUnderstandingWorkflow, [{ draftId: draft.id }]);

    await expect(run.returnValue).resolves.toMatchObject({ status: "understood" });
    expect(understandGoal).toHaveBeenCalledTimes(2);
    expect(classifyCourseIntent).toHaveBeenCalledOnce();
    expect(findExamDate).toHaveBeenCalledTimes(4);

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({
      status: "understood",
      understanding: {
        goals: [{ countryDependent: false, draft: { title: "Pass the bar" }, examDates: [] }],
      },
    });
  });

  it("reads the words with the learner's material, apart from the words read alone, and looks up no public exam for a test on it", async () => {
    vi.mocked(classifyCourseIntent).mockResolvedValue(taskResult({ intent: "learn" as const }));

    vi.mocked(understandGoal).mockResolvedValue(
      taskResult({
        followUps: [],
        goals: [
          {
            countryDependent: false,
            examDay: "official",
            examName: "Biology unit test",
            kind: "exam",
            subject: "the cell cycle",
            title: "Pass the cell cycle test",
          },
        ],
        route: "goals",
      }),
    );

    const user = await userFixture();
    const prompt = `test on Friday ${randomUUID()}`;
    const notesText = "Interphase: G1, S and G2. Mitosis: prophase, metaphase and anaphase.";

    const notes = await sourceFixture({ extractedText: notesText, kind: "upload", title: "" });

    await Promise.all([
      learnerSourceFixture({ sourceId: notes.id, userId: user.id }),
      goalUnderstandingFixture({ goal: prompt, result: { route: "unclear" }, userId: user.id }),
    ]);

    const draft = await onboardingDraftFixture({
      materialIntent: "exam",
      prompt,
      sourceIds: [notes.id],
      status: "understanding",
      userId: user.id,
    });

    const run = await start(goalUnderstandingWorkflow, [{ draftId: draft.id }]);
    await expect(run.returnValue).resolves.toMatchObject({ status: "understood" });

    expect(understandGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: prompt,
        material: { intent: "exam", overview: expect.stringContaining(notesText) },
      }),
    );

    expect(classifyCourseIntent).toHaveBeenCalledWith(expect.objectContaining({ prompt }));
    expect(decideExamIdentity).not.toHaveBeenCalled();
    expect(findExamDate).not.toHaveBeenCalled();

    await expect(
      prisma.goalUnderstanding.findMany({ select: { result: true }, where: { userId: user.id } }),
    ).resolves.toStrictEqual([{ result: { route: "unclear" } }]);

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({
      status: "understood",
      understanding: { goals: [{ draft: { title: "Pass the cell cycle test" }, examDates: [] }] },
    });
  });

  it.each([
    { readState: "read", text: "Mitosis starts after interphase." },
    { readState: "read", text: "[illegible]" },
    { readState: "failed", text: null },
  ])(
    "waits for a photo to settle as $readState with transcript $text before reading the goal",
    async ({ readState, text }) => {
      vi.stubEnv("PRIVATE_BLOB_STORE_ID", "store_test");
      vi.mocked(classifyCourseIntent).mockResolvedValue(taskResult({ intent: "learn" as const }));
      vi.mocked(understandGoal).mockResolvedValue(taskResult({ route: "unclear" }));
      const wordless = text === null || text === "[illegible]";

      vi.mocked(transcribeMaterial).mockImplementation(async () => {
        expect(understandGoal).not.toHaveBeenCalled();

        if (text === null) {
          throw new Error("Transcription service is unavailable");
        }

        return taskResult({ text });
      });

      const user = await userFixture();
      const pathname = `sources/${user.id}/${randomUUID()}-notes.png`;
      const url = `https://store.private.blob.vercel-storage.com/${pathname}`;

      const image = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC",
        "base64",
      );

      vi.mocked(get).mockImplementation(async () => ({
        blob: {
          cacheControl: "",
          contentDisposition: "",
          contentType: "image/png",
          downloadUrl: url,
          etag: "",
          pathname,
          size: image.length,
          uploadedAt: new Date(),
          url,
        },
        headers: new Headers(),
        statusCode: 200,
        stream: new Blob([image]).stream(),
      }));

      const photo = await sourceFixture({
        blobUrl: url,
        contentHash: randomUUID(),
        kind: "upload",
        mimeType: "image/png",
        ownerId: user.id,
        readState: "owed",
        structure: { images: 0, pages: null, topic: null, visualPages: [0] },
        visibility: "private",
      });

      await learnerSourceFixture({ sourceId: photo.id, userId: user.id });

      const draft = await onboardingDraftFixture({
        materialIntent: "exam",
        prompt: "test tomorrow",
        sourceIds: [photo.id],
        status: "understanding",
        userId: user.id,
      });

      const run = await start(goalUnderstandingWorkflow, [{ draftId: draft.id }]);
      await expect(run.returnValue).resolves.toMatchObject({ status: "understood" });

      expect(transcribeMaterial).toHaveBeenCalledTimes(text === null ? 4 : 1);

      expect(understandGoal).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          goal: "test tomorrow",
          material: expect.objectContaining({ intent: "exam" }),
        }),
      );

      const overview = vi.mocked(understandGoal).mock.lastCall?.[0].material?.overview;
      expect(overview?.includes(text ?? "") ?? null).toBe(wordless ? null : true);

      await expect(
        prisma.source.findUniqueOrThrow({ where: { id: photo.id } }),
      ).resolves.toMatchObject({ readState });

      vi.unstubAllEnvs();
    },
  );

  it("looks up the dates of a public exam the words name, even with the learner's material", async () => {
    const exam = `ENEM ${randomUUID().slice(0, 8)}`;

    vi.mocked(decideExamIdentity).mockResolvedValue(null);
    vi.mocked(classifyCourseIntent).mockResolvedValue(taskResult({ intent: "learn" as const }));
    vi.mocked(findExamDate).mockRejectedValue(new Error("The search is down"));

    vi.mocked(understandGoal).mockResolvedValue(
      taskResult({
        followUps: [],
        goals: [
          {
            countryDependent: false,
            examDay: "official",
            examName: exam,
            kind: "exam",
            subject: "the ENEM",
            title: `Pass ${exam}`,
          },
        ],
        route: "goals",
      }),
    );

    const user = await userFixture();
    const notes = await sourceFixture({ extractedText: "Funções e logaritmos.", kind: "upload" });
    await learnerSourceFixture({ sourceId: notes.id, userId: user.id });

    const draft = await onboardingDraftFixture({
      materialIntent: "exam",
      prompt: exam,
      sourceIds: [notes.id],
      status: "understanding",
      userId: user.id,
    });

    const run = await start(goalUnderstandingWorkflow, [{ draftId: draft.id }]);
    await expect(run.returnValue).resolves.toMatchObject({ status: "understood" });

    expect(findExamDate).toHaveBeenCalledWith(expect.objectContaining({ exam }));
  });

  it("reads an upload merged into a shared copy after the draft was saved", async () => {
    vi.mocked(understandGoal).mockResolvedValue(taskResult({ route: "unclear" }));

    const user = await userFixture();
    const sharedText = `Interphase and mitosis ${randomUUID()}`;

    const [upload, shared] = await Promise.all([
      sourceFixture({ extractedText: "The private copy", kind: "upload", ownerId: user.id }),
      sourceFixture({ extractedText: sharedText, kind: "upload" }),
    ]);

    await learnerSourceFixture({ sourceId: shared.id, userId: user.id });

    await prisma.$transaction([
      prisma.sourceRedirect.create({
        data: { fromId: upload.id, toId: shared.id, userId: user.id },
      }),
      prisma.source.delete({ where: { id: upload.id } }),
    ]);

    await understandGoalWords({
      id: randomUUID(),
      language: "en",
      materialIntent: "exam",
      prompt: "test on Friday",
      sourceIds: [upload.id],
      status: "understanding",
      timeZone: "UTC",
      userId: user.id,
    });

    expect(understandGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        material: { intent: "exam", overview: expect.stringContaining(sharedText) },
      }),
    );
  });

  it("decides each stored candidate in a step of its own, retrying only the decision that failed", async () => {
    const town = randomUUID().slice(0, 8);
    const source = await sourceFixture({ title: "Official notice" });

    const storedBarExam = (date: string) =>
      examBlueprintFixture({
        edition: {
          check: null,
          citations: [],
          dates: [
            {
              citation: { passage: "The exam takes place on", sourceId: source.id },
              date,
              kind: "exam",
              label: "Exam day",
              startTime: null,
            },
          ],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: null,
          year: 2027,
        },
        name: `County Bar Exam ${town}`,
      });

    const [failing, sibling] = await Promise.all([
      storedBarExam("2027-03-14"),
      storedBarExam("2027-09-12"),
    ]);

    vi.mocked(classifyCourseIntent).mockResolvedValue(taskResult({ intent: "learn" as const }));

    vi.mocked(understandGoal).mockResolvedValue(
      taskResult({
        followUps: [],
        goals: [
          {
            countryDependent: false,
            examDay: "official",
            examName: `The ${town} County Bar Exam`,
            examYear: 2027,
            kind: "exam",
            subject: "Law",
            title: "Pass the bar",
          },
        ],
        route: "goals",
      }),
    );

    let failed = false;

    vi.mocked(decideExamIdentity).mockImplementation(async ({ candidates: [candidate] }) => {
      if (candidate?.id === failing.id && !failed) {
        failed = true;
        throw new Error("The model is down");
      }

      const probabilities = { [failing.id]: 0.9, [sibling.id]: 0.7 };
      const probability = candidate && probabilities[candidate.id];

      return candidate && probability ? { id: candidate.id, probability } : null;
    });

    const user = await userFixture();

    const draft = await onboardingDraftFixture({
      prompt: `pass the ${town} bar ${randomUUID()}`,
      status: "understanding",
      userId: user.id,
    });

    const run = await start(goalUnderstandingWorkflow, [{ draftId: draft.id }]);
    await expect(run.returnValue).resolves.toMatchObject({ status: "understood" });

    const { calls } = vi.mocked(decideExamIdentity).mock;

    const decided = calls.flatMap(([{ candidates }]) =>
      candidates.map((candidate) => candidate.id),
    );

    expect(calls.every(([{ candidates }]) => candidates.length === 1)).toBe(true);
    expect(decided.filter((id) => id === failing.id)).toHaveLength(2);
    expect(decided.filter((id) => id === sibling.id)).toHaveLength(1);
    expect(findExamDate).not.toHaveBeenCalled();

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({
      status: "understood",
      understanding: {
        goals: [{ countryDependent: false, examDates: [{ date: "2027-03-14", estimated: false }] }],
      },
    });
  });
});

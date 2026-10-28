import { randomUUID } from "node:crypto";
import { generateChallengeCase } from "@zoonk/ai/tasks/v2/challenge/case";
import { prisma } from "@zoonk/db";
import { writtenChallengeCaseFixture } from "@zoonk/testing/fixtures/challenge-written-case";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseStepContent } from "../steps/contract/step-contract";
import { createChapterChallenge } from "./chapter-challenge";
import { writeChallengeLessonContent } from "./write-challenge-content";

type Written = Awaited<ReturnType<typeof generateChallengeCase>>;

function written(data: Written["data"]): Written {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the data and provenance are read.
  return {
    data,
    provenance: {
      generatedAt: new Date().toISOString(),
      model: "openai/gpt-6-sol",
      promptVersion: "test",
      runId: randomUUID(),
    },
  } as Written;
}

function brokenCase(): Written["data"] {
  return { ...writtenChallengeCaseFixture(), startNodeId: "missing" };
}

async function claimedChallenge() {
  const chapter = await libraryChapterFixture({ title: "A/B tests" });
  const workflowRunId = `run-${randomUUID()}`;

  const lessonId = await createChapterChallenge({
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    language: "en",
    level: "beginner",
    ownerId: null,
    provenance: { generatedAt: new Date(), model: "test", promptVersion: "test", runId: "test" },
    skills: ["Judge whether a gap is chance"],
    targetLanguage: null,
  });

  await prisma.lesson.update({
    data: { contentRunId: workflowRunId, contentStatus: "running" },
    where: { id: lessonId ?? "" },
  });

  return { chapter, lessonId: lessonId ?? "", workflowRunId };
}

describe(writeChallengeLessonContent, () => {
  beforeEach(() => {
    vi.mocked(generateChallengeCase).mockReset();
  });

  it("publishes the case as the lesson's one screen with its summary card, at the tier asked", async () => {
    const { lessonId, workflowRunId } = await claimedChallenge();
    vi.mocked(generateChallengeCase).mockResolvedValue(written(writtenChallengeCaseFixture()));

    await expect(
      writeChallengeLessonContent({ lessonId, serviceTier: "flex", workflowRunId }),
    ).resolves.toStrictEqual({ status: "published" });

    expect(generateChallengeCase).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterTitle: "A/B tests",
        level: "beginner",
        problems: [],
        serviceTier: "flex",
        skills: [{ description: null, name: "Judge whether a gap is chance" }],
        variant: "work",
      }),
    );

    const lesson = await prisma.lesson.findUniqueOrThrow({
      include: { steps: true },
      where: { id: lessonId },
    });

    expect(lesson.contentStatus).toBe("completed");

    expect(lesson.summary).toStrictEqual({
      ideas: writtenChallengeCaseFixture().summary.map((text) => ({ text })),
    });

    expect(lesson.steps.map((step) => step.kind)).toStrictEqual(["challenge"]);

    expect(parseStepContent("challenge", lesson.steps[0]?.content)).toMatchObject({
      title: "Does button B sell more?",
      variant: "work",
    });
  });

  it("sends what failed back for one more draft", async () => {
    const { lessonId, workflowRunId } = await claimedChallenge();

    vi.mocked(generateChallengeCase)
      .mockResolvedValueOnce(written(brokenCase()))
      .mockResolvedValueOnce(written(writtenChallengeCaseFixture()));

    await expect(writeChallengeLessonContent({ lessonId, workflowRunId })).resolves.toStrictEqual({
      status: "published",
    });

    expect(vi.mocked(generateChallengeCase).mock.calls[1]?.[0].problems).toContain(
      "startNodeId: The case must start with a decision",
    );
  });

  it("holds the case back and frees the lesson when both drafts fail", async () => {
    const { lessonId, workflowRunId } = await claimedChallenge();
    vi.mocked(generateChallengeCase).mockResolvedValue(written(brokenCase()));

    await expect(writeChallengeLessonContent({ lessonId, workflowRunId })).resolves.toMatchObject({
      status: "heldBack",
    });

    await expect(
      prisma.lesson.findUniqueOrThrow({ include: { steps: true }, where: { id: lessonId } }),
    ).resolves.toMatchObject({ contentStatus: "failed", steps: [] });
  });

  it("writes nothing for a run that doesn't hold the lesson", async () => {
    const { lessonId } = await claimedChallenge();

    await expect(
      writeChallengeLessonContent({ lessonId, workflowRunId: "another-run" }),
    ).resolves.toStrictEqual({ status: "notClaimed" });

    expect(generateChallengeCase).not.toHaveBeenCalled();
  });
});

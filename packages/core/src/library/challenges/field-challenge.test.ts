import { randomUUID } from "node:crypto";
import { assembleChallengeCase, draftEmptyScript } from "@zoonk/ai/tasks/challenge/assemble";
import { prisma } from "@zoonk/db";
import { challengePlanFixture } from "@zoonk/testing/fixtures/challenge-plan";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it } from "vitest";
import { checkWrittenChallenge } from "./challenge-case-content";
import { type ScriptedChallenge } from "./challenge-draft";
import { loadChallengeLessonDraft } from "./challenge-lesson-draft";
import { finishFieldChallengeDraft, prepareFieldChallengeDraft } from "./field-challenge";
import { getFieldChallengeToken } from "./field-challenge-token";

async function step() {
  const { steps } = await playableLessonFixture({
    lesson: {
      spec: { kind: "challenge", skills: [{ description: null, name: "Chance" }], variant: "work" },
    },
    steps: ["challenge"],
  });

  return steps[0]?.id ?? "";
}

function scripted(): ScriptedChallenge {
  const plan = challengePlanFixture();
  const { written } = assembleChallengeCase({ plan, script: draftEmptyScript(plan) });
  const { content } = checkWrittenChallenge({ variant: "work", written });

  if (!content) {
    throw new Error("The plan fixture's empty script should pass the content check");
  }

  return {
    content,
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 0,
      model: "openai/gpt-6.1-sol",
      promptVersion: "test",
      provider: "openai",
      requestedModel: "openai/gpt-6.1-sol",
      runId: randomUUID(),
      usage: {},
    },
    summary: { ideas: [], shape: "hub" as const },
    writerModels: ["openai/gpt-6.1-sol"],
  };
}

describe("field challenge admission", () => {
  it.each(["PT", null])(
    "loads the course country %s for chapter and field drafts",
    async (country) => {
      const course = await courseFixture({ country, language: "pt" });
      const chapter = await libraryChapterFixture({ homeCourseId: course.id });
      const workflowRunId = randomUUID();

      const { lesson, steps } = await playableLessonFixture({
        lesson: {
          contentRunId: workflowRunId,
          contentStatus: "running",
          homeChapterId: chapter.id,
          language: "pt",
          spec: {
            kind: "challenge",
            skills: [{ description: null, name: "Chance" }],
            variant: "work",
          },
        },
        steps: ["challenge"],
      });

      await expect(
        loadChallengeLessonDraft({ lessonId: lesson.id, workflowRunId }),
      ).resolves.toMatchObject({ params: { country, language: "pt" } });

      await prisma.lesson.update({
        data: { contentStatus: "completed" },
        where: { id: lesson.id },
      });

      await expect(
        prepareFieldChallengeDraft({ field: "nursing", stepId: steps[0]?.id ?? "", workflowRunId }),
      ).resolves.toMatchObject({ params: { country, language: "pt" }, status: "challengeDraft" });
    },
  );

  it("normalizes tokens and reservation keys, then replays published content", async () => {
    const stepId = await step();
    const input = { field: "Nursing", stepId, workflowRunId: randomUUID() };

    expect(getFieldChallengeToken(input)).toBe(
      getFieldChallengeToken({ ...input, field: "nursing" }),
    );

    await expect(prepareFieldChallengeDraft(input)).resolves.toMatchObject({
      params: { field: "nursing" },
      status: "challengeDraft",
    });

    await expect(finishFieldChallengeDraft({ ...input, draft: scripted() })).resolves.toMatchObject(
      { created: true, status: "ready" },
    );

    await expect(prepareFieldChallengeDraft(input)).resolves.toMatchObject({ status: "ready" });
  });

  it("records one rejection per preparation, sends earlier problems, and exhausts after three", async () => {
    const stepId = await step();
    const input = { field: "retail", stepId, workflowRunId: randomUUID() };
    await prepareFieldChallengeDraft(input);

    await finishFieldChallengeDraft({
      ...input,
      draft: { model: "openai/gpt-6.1-sol", problems: ["Wrong result"] },
    });

    await expect(prepareFieldChallengeDraft(input)).resolves.toMatchObject({ status: "heldBack" });

    await Promise.all(
      [randomUUID(), randomUUID()].map(async (run) => {
        const next = { ...input, workflowRunId: run };

        await expect(prepareFieldChallengeDraft(next)).resolves.toMatchObject({
          params: { problems: expect.arrayContaining(["Wrong result"]) },
          status: "challengeDraft",
        });

        await finishFieldChallengeDraft({
          ...next,
          draft: { model: "openai/gpt-6.1-sol", problems: ["Wrong result"] },
        });
      }),
    );

    await expect(
      prepareFieldChallengeDraft({ ...input, workflowRunId: randomUUID() }),
    ).resolves.toMatchObject({ status: "exhausted" });

    const generation = await prisma.stepVariantGeneration.findFirstOrThrow({ where: { stepId } });
    expect(generation.heldBackDrafts).toHaveLength(3);
    await expect(prisma.stepVariant.count({ where: { stepId } })).resolves.toBe(0);
  });
});

import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { languageLessonDraft } from "../_test-utils/language-lesson-draft";
import { republishLanguageLesson, saveLanguageLesson } from "./save-language-lesson";

const provenance = () => ({
  generatedAt: new Date(),
  model: "test",
  promptVersion: "test",
  runId: randomUUID(),
});

describe(republishLanguageLesson, () => {
  it("saves a fix as the version learners get, and nothing once another version replaced it", async () => {
    const { lesson, sentence } = await languageLessonFixture();
    const workflowRunId = randomUUID();

    await prisma.lesson.update({
      data: { contentRunId: workflowRunId, contentStatus: "running" },
      where: { id: lesson.id },
    });

    const content = languageLessonDraft();

    const rows = {
      content: { ...content, sentences: content.sentences.slice(0, 1) },
      lessonId: lesson.id,
      provenance: provenance(),
      sentenceIds: [sentence.id],
      skillId: null,
      steps: [
        {
          content: { text: "Before the fix", title: "Rent" },
          kind: "explanation" as const,
          sentenceId: null,
          wordId: null,
        },
      ],
      wordIds: [],
    };

    const published = await saveLanguageLesson({ ...rows, workflowRunId });

    if (published === null) {
      throw new Error("The first version wasn't saved.");
    }

    const fixedContent = { ...rows.content, summary: ["After the fix"] };

    const fix = {
      ...rows,
      content: fixedContent,
      provenance: provenance(),
      steps: [{ ...rows.steps[0]!, content: { text: "After the fix", title: "Rent" } }],
    };

    await expect(republishLanguageLesson({ ...fix, replaces: published })).resolves.toBe(
      published + 1,
    );

    await expect(
      prisma.step.findMany({
        select: { content: true, version: true },
        where: { lessonId: lesson.id, retiredAt: null, staged: false },
      }),
    ).resolves.toStrictEqual([
      { content: { text: "After the fix", title: "Rent" }, version: published + 1 },
    ]);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ summary: { ideas: [{ text: "After the fix" }] } });

    await expect(republishLanguageLesson({ ...fix, replaces: published })).resolves.toBeNull();
  });
});

describe(saveLanguageLesson, () => {
  it("gives replaced sentences a fresh order budget without resetting it on a replay", async () => {
    const { lesson, sentence } = await languageLessonFixture();
    const workflowRunId = randomUUID();

    await prisma.lesson.update({
      data: { contentRunId: workflowRunId, contentStatus: "running", sentenceOrdersAttempts: 8 },
      where: { id: lesson.id },
    });

    const content = languageLessonDraft();

    const input = {
      content: { ...content, sentences: content.sentences.slice(0, 1) },
      lessonId: lesson.id,
      provenance: {
        generatedAt: new Date(),
        model: "test",
        promptVersion: "test",
        runId: randomUUID(),
      },
      sentenceIds: [sentence.id],
      skillId: null,
      steps: [],
      wordIds: [],
      workflowRunId,
    };

    await expect(saveLanguageLesson(input)).resolves.toStrictEqual(expect.any(Number));

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ sentenceOrdersAttempts: 0 });

    await expect(
      prisma.lessonSentence.findMany({ where: { lessonId: lesson.id } }),
    ).resolves.toMatchObject([{ ordersOwedAt: expect.any(Date), sentenceId: sentence.id }]);

    await prisma.lesson.update({ data: { sentenceOrdersAttempts: 3 }, where: { id: lesson.id } });

    await expect(saveLanguageLesson(input)).resolves.toBeNull();

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ sentenceOrdersAttempts: 3 });
  });

  it("marks each plan reading the lesson's skill changed content once, and nothing on a replay", async () => {
    const workflowRunId = randomUUID();

    const [user, skill, lesson] = await Promise.all([
      userFixture(),
      skillFixture(),
      libraryLessonFixture({
        contentRunId: workflowRunId,
        contentStatus: "running",
        language: "pt",
        targetLanguage: "en",
      }),
    ]);

    const [goal] = await Promise.all([
      goalFixture({ userId: user.id }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ]);

    const plan = await planFixture({ goalId: goal.id, sourceSkillIds: [skill.id] });

    const input = {
      content: languageLessonDraft(),
      lessonId: lesson.id,
      provenance: {
        generatedAt: new Date(),
        model: "test",
        promptVersion: "test",
        runId: randomUUID(),
      },
      sentenceIds: [],
      skillId: skill.id,
      steps: [
        {
          content: { text: "Recognize a rent question", title: "Rent" },
          kind: "explanation" as const,
          sentenceId: null,
          wordId: null,
        },
      ],
      wordIds: [],
      workflowRunId,
    };

    await expect(saveLanguageLesson(input)).resolves.toStrictEqual(expect.any(Number));
    await expect(saveLanguageLesson(input)).resolves.toBeNull();

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      sourceVersion: plan.sourceVersion + 1,
    });
  });
});

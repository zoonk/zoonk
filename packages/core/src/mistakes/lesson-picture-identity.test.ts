import { prisma } from "@zoonk/db";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { findPlayableStepRow } from "../lesson-player/_utils/lesson-rows";
import { loadPlayableSteps } from "../lesson-player/_utils/load-playable-steps";
import { type MistakeReplay } from "./mistake-replay";

async function servedReplay(stepId: string, userId: string) {
  const row = await findPlayableStepRow({ stepId, userId });

  if (!row) {
    throw new Error("Expected a playable step row");
  }

  const [step] = await loadPlayableSteps({ lesson: row.lesson, rows: [row] });

  if (!step) {
    throw new Error("Expected a playable step");
  }

  return {
    kind: "lesson" as const,
    lesson: {
      language: row.lesson.language,
      lessonId: row.lessonId,
      level: row.lesson.level,
      step,
      targetLanguage: row.lesson.targetLanguage,
    },
  };
}

function answer({
  correct,
  replay,
  stepId,
  skillId,
  userId,
  answeredAt,
}: {
  correct: boolean;
  replay: MistakeReplay;
  stepId: string;
  skillId: string;
  userId: string;
  answeredAt: Date;
}) {
  return recordLearnerAnswer({
    answer: { kind: "check", optionId: correct ? "right" : "wrong" },
    answeredAt,
    graded: { durationMs: 3000, isCorrect: correct },
    language: "en",
    mistake: {
      questionText: "Which original answer?",
      snapshot: {
        answer: "x",
        correctAnswer: "Original right",
        format: "check",
        question: "Which original answer?",
        replay,
      },
    },
    purpose: "learning",
    skillId,
    stepId,
    timeZone: "UTC",
    userId,
  });
}

describe("lesson replay identity vs picture arrival", () => {
  it.each(["drawn", "replaced"] as const)(
    "keeps one original when its picture is %s",
    async (change) => {
      const [user, skill, lesson] = await Promise.all([
        userFixture(),
        skillFixture(),
        libraryLessonFixture(),
      ]);

      await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });

      const step = await libraryStepFixture({
        content: {
          basis: null,
          image: { alt: "A price tag", prompt: "A price tag" },
          options: [
            { id: "right", isCorrect: true, reason: "Because", text: "Original right" },
            { id: "wrong", isCorrect: false, reason: "No", text: "Original wrong" },
          ],
          question: "Which original answer?",
        },
        kind: "check",
        lessonId: lesson.id,
        skillId: skill.id,
      });

      if (change === "replaced") {
        const previous = await mediaAssetFixture();
        await prisma.step.update({ data: { mediaAssetId: previous.id }, where: { id: step.id } });
      }

      const before = await servedReplay(step.id, user.id);

      const wrong = await answer({
        answeredAt: new Date(Date.now() - 2 * 86_400_000),
        correct: false,
        replay: before,
        skillId: skill.id,
        stepId: step.id,
        userId: user.id,
      });

      expect(wrong.mistake).not.toBeNull();

      await prisma.mistake.update({
        data: { createdAt: new Date(Date.now() - 2 * 86_400_000) },
        where: { id: wrong.mistake!.id },
      });

      const asset = await mediaAssetFixture();
      await prisma.step.update({ data: { mediaAssetId: asset.id }, where: { id: step.id } });

      const after = await servedReplay(step.id, user.id);
      expect(after.lesson.step).toMatchObject({ image: { id: asset.id } });

      const again = await answer({
        answeredAt: new Date(),
        correct: false,
        replay: after,
        skillId: skill.id,
        stepId: step.id,
        userId: user.id,
      });

      const open = await prisma.mistake.count({
        where: { status: "open", stepId: step.id, userId: user.id },
      });

      const right = await answer({
        answeredAt: new Date(),
        correct: true,
        replay: after,
        skillId: skill.id,
        stepId: step.id,
        userId: user.id,
      });

      expect(again.mistake?.id).toBe(wrong.mistake?.id);
      expect(open).toBe(1);
      expect(right.fixedMistakeIds).toStrictEqual([wrong.mistake!.id]);

      const saved = await prisma.mistake.findUniqueOrThrow({ where: { id: wrong.mistake!.id } });
      expect(saved.snapshot).toMatchObject({ replay: before });
    },
  );
});

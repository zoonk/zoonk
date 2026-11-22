import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { describe, expect, it } from "vitest";
import { writeLanguageStepEvidence } from "../../language/levels/record-language-evidence";
import { recordLessonWindowAnswer } from "./record-lesson-window";

describe("language lesson placement offers", () => {
  it.each([
    { from: 2.5, offer: { kind: "levelTestOut", level: "B2" }, outlined: true },
    { from: 2.5, offer: { kind: "quick" }, outlined: false },
    { from: 2, offer: { kind: "quick" }, outlined: true },
  ])(
    "selects the offer when an easy window closes from score $from with outlines $outlined",
    async ({ from, offer, outlined }) => {
      const {
        goal,
        lessons: [lesson],
        items,
        skills,
        user,
      } = await languageGoalFixture();

      const [upcoming] = items.slice(2);
      const [skill, , nextSkill] = skills;

      if (!lesson || !skill || !upcoming || !nextSkill || !goal.targetLanguage) {
        throw new Error("Expected a language lesson");
      }

      const language = goal.targetLanguage;
      const userId = user.id;

      const [step, event] = await Promise.all([
        libraryStepFixture({ kind: "multipleChoice", lessonId: lesson.id }),
        learningEventFixture({ contentIds: { lessonId: lesson.id }, userId }),
        prisma.skill.update({ data: { cefrLevel: "B2" }, where: { id: nextSkill.id } }),
        ...(outlined
          ? []
          : [
              prisma.planItem.update({
                data: { chapterId: null, lessonId: null, lessons: 1 },
                where: { id: upcoming.id },
              }),
            ]),
        prisma.languageSkillLevel.create({
          data: {
            language,
            livingPlanWindow: {
              closed: {
                at: "2026-11-19T00:00:00.000Z",
                missedSkillIds: [],
                result: "easy",
                score: from,
                streak: 1,
              },
              correct: 19,
              missedSkillIds: [],
              total: 19,
            },
            score: from,
            skill: "reading",
            startScore: from,
            userId,
            windowCeiling: 3.5,
            windowCorrect: 19,
            windowTotal: 19,
          },
        }),
      ]);

      const [attempt, run] = await Promise.all([
        attemptFixture({ skillId: skill.id, stepId: step.id, userId }),
        prisma.learningEvent.update({ data: { endedAt: null }, where: { id: event.id } }),
      ]);

      await prisma.$transaction(async (tx) => {
        await writeLanguageStepEvidence(tx, {
          isCorrect: true,
          skill: {
            evidence: { ceiling: 3.5, correct: 1, total: 1 },
            language,
            skill: "reading",
            startScore: from,
            userId,
          },
          word: null,
        });

        await recordLessonWindowAnswer(tx, { attempt, kind: step.kind, lessonId: lesson.id, run });
      });

      await expect(
        prisma.learningEvent.findUnique({ where: { id: run.id } }),
      ).resolves.toMatchObject({ contentIds: { placementOffer: { ...offer, goalId: goal.id } } });

      await expect(
        prisma.languageSkillLevel.findUnique({
          where: { userLanguageSkill: { language, skill: "reading", userId } },
        }),
      ).resolves.toMatchObject({ livingPlanWindow: { closed: { score: from + 0.5, streak: 2 } } });
    },
  );
});

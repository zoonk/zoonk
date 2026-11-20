import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { examStructure } from "../../library/exams/_test-utils/exam-formats";
import { loadMockWritingSkills } from "./prepare-mock-questions";

describe(loadMockWritingSkills, () => {
  it("compares full questions and answer keys from public bank and lesson questions, including the reserve", async () => {
    const [user, skill, blueprint, lesson] = await Promise.all([
      userFixture(),
      skillFixture(),
      examBlueprintFixture({
        board: "Cebraspe",
        structure: {
          ...examStructure(["trueFalse"]),
          mock: {
            adaptive: false,
            citations: [],
            order: null,
            scoring: {
              description: "Every error cancels a correct answer.",
              method: "wrongCancelsRight",
            },
            sections: [],
            timeLimitMinutes: 300,
            totalQuestions: 170,
          },
        },
      }),
      libraryLessonFixture(),
    ]);

    const [goal, privateLesson, privateSource] = await Promise.all([
      goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id }),
      libraryLessonFixture({ ownerId: user.id, visibility: "private" }),
      sourceFixture({ ownerId: user.id, visibility: "private" }),
    ]);

    const prompt = `${"A long public case. ".repeat(15)}What changed last?`;

    await Promise.all([
      itemFixture({
        content: choiceItemContent(prompt),
        examBlueprintId: blueprint.id,
        mockOnly: true,
        skillId: skill.id,
      }),
      itemFixture({
        content: { ...choiceItemContent("Confidential exam example?"), quoted: true },
        examBlueprintId: blueprint.id,
        skillId: skill.id,
        sourceId: privateSource.id,
      }),
      libraryStepFixture({
        content: {
          answers: ["cloud"],
          distractors: ["ring"],
          feedback: "Correct.",
          question: "Fill in the blank",
          template: "The electron forms a [BLANK].",
        },
        kind: "fillBlank",
        lessonId: lesson.id,
        skillId: skill.id,
      }),
      libraryStepFixture({
        content: { question: "Private lesson secret?", sampleAnswer: "Confidential" },
        kind: "typedAnswer",
        lessonId: privateLesson.id,
        skillId: skill.id,
      }),
    ]);

    const [writing] = await loadMockWritingSkills({ goalId: goal.id, skillIds: [skill.id] });
    expect(writing?.earlier).toHaveLength(2);

    expect(writing?.earlier).toStrictEqual(
      expect.arrayContaining([
        { answer: "Right answer", question: expect.stringContaining(prompt) },
        { answer: "cloud", question: expect.stringContaining("The electron forms a [BLANK].") },
      ]),
    );

    expect(writing?.exam?.pastQuestions).toStrictEqual([]);
    expect(writing?.wrongPenalty).toBe(1);
    expect(writing?.exam?.name).toContain("Cebraspe");
  });
});

import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { temperatureSpec } from "../quality/_test-utils/written-lessons";
import { loadLessonSpecInputs } from "./lesson-spec-inputs";

async function placeLessons(chapterId: string, lessonIds: string[]) {
  await Promise.all(
    lessonIds.map((lessonId, position) => chapterLessonFixture({ chapterId, lessonId, position })),
  );
}

describe(loadLessonSpecInputs, () => {
  it("plans a lesson with what its chapter's other lessons teach and use so far", async () => {
    const chapter = await libraryChapterFixture();

    const [written, planned, lesson, outlined] = await Promise.all([
      libraryLessonFixture({
        canDo: "Read a thermometer below zero",
        contentStatus: "completed",
        homeChapterId: chapter.id,
        spec: temperatureSpec(),
        specStatus: "completed",
        summary: { ideas: [{ text: "Below zero, a bigger number is colder." }] },
        title: "Temperatures below zero",
      }),
      libraryLessonFixture({
        canDo: "Add a rise to a temperature below zero",
        homeChapterId: chapter.id,
        spec: temperatureSpec(),
        specStatus: "completed",
        title: "Temperature rises",
      }),
      libraryLessonFixture({ homeChapterId: chapter.id, title: "Temperature drops" }),
      libraryLessonFixture({
        canDo: "Compare Celsius and Fahrenheit",
        homeChapterId: chapter.id,
        title: "Two scales",
      }),
    ]);

    await Promise.all([
      placeLessons(chapter.id, [written.id, planned.id, lesson.id, outlined.id]),
      libraryStepFixture({
        content: { text: "Zero is just a mark on the thermometer.", title: "Zero" },
        kind: "explanation",
        lessonId: written.id,
        position: 0,
      }),
      libraryStepFixture({
        content: { context: "It's −12 °C in Chicago.", question: "Is −15 °C colder?" },
        kind: "check",
        lessonId: written.id,
        position: 1,
      }),
    ]);

    const inputs = await loadLessonSpecInputs(lesson.id);

    expect(inputs?.prompt.chapterLessons).toStrictEqual([
      {
        canDo: "Read a thermometer below zero",
        examples: ["It's −12 °C in Chicago. Is −15 °C colder?"],
        ideas: ["Below zero, a bigger number is colder."],
        order: "before",
        title: "Temperatures below zero",
      },
      {
        canDo: "Add a rise to a temperature below zero",
        examples: [
          "−3 °C plus a 5 degree rise is 2 °C.",
          "Guess the temperature after a rise.",
          "From −3 °C, rise 5 degrees.",
          "Calculate a rise from −4 °C.",
          "Explain why −3 + 5 is 2.",
          "A winter morning in Chicago.",
        ],
        ideas: ["A rise adds to the temperature, even when it starts below zero."],
        order: "before",
        title: "Temperature rises",
      },
      {
        canDo: "Compare Celsius and Fahrenheit",
        examples: [],
        ideas: [],
        order: "after",
        title: "Two scales",
      },
    ]);
  });

  it("leaves a learner's private lesson out of a shared lesson's plan", async () => {
    const [chapter, owner] = await Promise.all([libraryChapterFixture(), userFixture()]);

    const [privateLesson, lesson] = await Promise.all([
      libraryLessonFixture({
        homeChapterId: chapter.id,
        ownerId: owner.id,
        title: "My teacher's slides",
        visibility: "private",
      }),
      libraryLessonFixture({ homeChapterId: chapter.id, title: "Temperature drops" }),
    ]);

    await placeLessons(chapter.id, [privateLesson.id, lesson.id]);

    const inputs = await loadLessonSpecInputs(lesson.id);

    expect(inputs?.prompt.chapterLessons).toStrictEqual([]);
  });

  it("plans a lesson outside any chapter without other lessons", async () => {
    const lesson = await libraryLessonFixture({ title: "Temperature drops" });
    const inputs = await loadLessonSpecInputs(lesson.id);

    expect(inputs?.prompt.chapterLessons).toStrictEqual([]);
  });

  /*
   * A shared OAB lesson opened with "a entidade dos advogados do Brasil, chamada OAB" for law
   * graduates: the planner didn't know who studies it. It now gets the exams of the goals that
   * plan it, so it's written for their candidates (without naming them).
   */
  it("plans a lesson for the candidates of the exams whose goals plan it", async () => {
    const [chapter, user] = await Promise.all([libraryChapterFixture(), userFixture()]);

    const [publicExam, privateExam, lesson, other] = await Promise.all([
      examBlueprintFixture({ name: "OAB Exame de Ordem", role: "1ª fase" }),
      examBlueprintFixture({ name: "Prova de biologia", ownerId: user.id, visibility: "private" }),
      libraryLessonFixture({ homeChapterId: chapter.id, title: "Finalidades da OAB" }),
      libraryLessonFixture({ title: "Temperature drops" }),
    ]);

    const [examGoal, privateGoal, learnGoal] = await Promise.all([
      goalFixture({ examBlueprintId: publicExam.id, kind: "exam", userId: user.id }),
      goalFixture({ examBlueprintId: privateExam.id, kind: "exam", userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const [examPlan, privatePlan, learnPlan] = await Promise.all([
      planFixture({ goalId: examGoal.id }),
      planFixture({ goalId: privateGoal.id }),
      planFixture({ goalId: learnGoal.id }),
    ]);

    await Promise.all([
      planItemFixture({ chapterId: chapter.id, planId: examPlan.id, position: 0 }),
      planItemFixture({ lessonId: lesson.id, planId: privatePlan.id, position: 0 }),
      planItemFixture({ lessonId: lesson.id, planId: learnPlan.id, position: 0 }),
      planItemFixture({ lessonId: other.id, planId: learnPlan.id, position: 1 }),
    ]);

    const [examLesson, learnLesson] = await Promise.all([
      loadLessonSpecInputs(lesson.id),
      loadLessonSpecInputs(other.id),
    ]);

    expect(examLesson?.prompt.exams?.map((exam) => exam.name)).toStrictEqual([
      "OAB Exame de Ordem, 1ª fase",
    ]);

    expect(learnLesson?.prompt.exams).toStrictEqual([]);
  });
});

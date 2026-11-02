import { randomUUID } from "node:crypto";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { buildSetupSkillIdentityKey } from "@zoonk/utils/identity-key";
import { describe, expect, it } from "vitest";
import { createPlanGenerationManifest } from "../../lookahead/speculative-lessons";
import { examFormat, examStructure } from "../exams/_test-utils/exam-formats";
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
        content: { basis: null, context: "It's −12 °C in Chicago.", question: "Is −15 °C colder?" },
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

  it("plans a setup lesson with the setup rules, and other lessons without them", async () => {
    const [setupSkill, otherSkill, setupLesson, otherLesson] = await Promise.all([
      skillFixture({
        identityKey: buildSetupSkillIdentityKey({ system: "windows", tool: randomUUID() }),
        name: "Set up Python on Windows",
      }),
      skillFixture({ name: "Read a thermometer below zero" }),
      libraryLessonFixture({ title: "Set up Python on Windows" }),
      libraryLessonFixture({ title: "Temperatures below zero" }),
    ]);

    await Promise.all([
      lessonSkillFixture({ lessonId: setupLesson.id, skillId: setupSkill.id }),
      lessonSkillFixture({ lessonId: otherLesson.id, skillId: otherSkill.id }),
    ]);

    const [setup, other] = await Promise.all([
      loadLessonSpecInputs(setupLesson.id),
      loadLessonSpecInputs(otherLesson.id),
    ]);

    expect(setup?.prompt.setup).toBe(true);
    expect(other?.prompt.setup).toBe(false);
  });

  it("plans a lesson outside any chapter without other lessons", async () => {
    const lesson = await libraryLessonFixture({ title: "Temperature drops" });
    const inputs = await loadLessonSpecInputs(lesson.id);

    expect(inputs?.prompt.chapterLessons).toStrictEqual([]);
  });

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

  it("lets a lesson ask short written answers only when an exam of the goals that plan it does", async () => {
    const user = await userFixture();

    const [shortAnswers, essay, classTest, ...lessons] = await Promise.all([
      examBlueprintFixture({ structure: examStructure(["multipleChoice", "shortAnswer"]) }),
      examBlueprintFixture({ structure: examStructure(["multipleChoice", "essay"]) }),
      examBlueprintFixture({
        ownerId: user.id,
        structure: examStructure(["multipleChoice", "shortAnswer"]),
        visibility: "private",
      }),
      ...Array.from({ length: 4 }, () => libraryLessonFixture({ title: "Partes da célula" })),
    ]);

    const goals = await Promise.all([
      goalFixture({ examBlueprintId: shortAnswers.id, kind: "exam", userId: user.id }),
      goalFixture({ examBlueprintId: essay.id, kind: "exam", userId: user.id }),
      goalFixture({ userId: user.id }),
      goalFixture({ examBlueprintId: classTest.id, kind: "exam", userId: user.id }),
      goalFixture({
        details: { noticeFormats: [examFormat("shortAnswer")] },
        kind: "exam",
        userId: user.id,
      }),
    ]);

    const plans = await Promise.all(goals.map((goal) => planFixture({ goalId: goal.id })));
    const plannedLessons = [lessons[0], lessons[1], lessons[1], lessons[2], lessons[3]];

    await Promise.all(
      plans.map((plan, index) =>
        planItemFixture({ lessonId: plannedLessons[index]?.id, planId: plan.id, position: 0 }),
      ),
    );

    const inputs = await Promise.all(lessons.map((lesson) => loadLessonSpecInputs(lesson.id)));

    expect(inputs.map((input) => input?.prompt.shortAnswers)).toStrictEqual([
      true,
      false,
      true,
      true,
    ]);

    expect(inputs[2]?.prompt.exams).toStrictEqual([]);
  });

  it("plans a lesson for a goal whose stand-in for its skill it fills, in the course the goal learns it from", async () => {
    const [user, skill, secondary, other, ownCourse] = await Promise.all([
      userFixture(),
      skillFixture(),
      courseFixture(),
      courseFixture(),
      courseFixture(),
    ]);

    const [shortAnswers, elsewhere, chapter] = await Promise.all([
      examBlueprintFixture({
        name: "Short answers exam",
        structure: examStructure(["multipleChoice", "shortAnswer"]),
      }),
      examBlueprintFixture({
        name: "Another course's exam",
        structure: examStructure(["multipleChoice", "shortAnswer"]),
      }),
      libraryChapterFixture({ homeCourseId: secondary.id }),
    ]);

    const [lesson] = await Promise.all([
      libraryLessonFixture({ homeChapterId: chapter.id, title: "Partes da célula" }),
      courseChapterFixture({ chapterId: chapter.id, courseId: secondary.id }),
    ]);

    await Promise.all([
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ]);

    const goals = await Promise.all(
      [
        { blueprint: shortAnswers, course: secondary },
        { blueprint: elsewhere, course: other },
      ].map(async ({ blueprint, course }) => {
        const goal = await goalFixture({
          examBlueprintId: blueprint.id,
          kind: "exam",
          primaryCourseId: ownCourse.id,
          userId: user.id,
        });

        const plan = await planFixture({
          goalId: goal.id,
          graph: {
            phases: [{ milestone: null, name: "Phase" }],
            skills: [
              {
                area: "Biology",
                courseIds: [course.id],
                lessons: 1,
                name: skill.name,
                phase: 0,
                skillId: skill.id,
                weight: null,
              },
            ],
          },
        });

        await planItemFixture({ planId: plan.id, position: 0, skillId: skill.id });
        return goal;
      }),
    );

    const [manifest, inputs] = await Promise.all([
      createPlanGenerationManifest({ goalId: goals[0]?.id ?? "", lessonIds: [lesson.id] }),
      loadLessonSpecInputs(lesson.id),
    ]);

    expect(manifest?.targets.map((target) => target.lessonId)).toStrictEqual([lesson.id]);
    expect(inputs?.prompt.shortAnswers).toBe(true);
    expect(inputs?.prompt.exams?.map((exam) => exam.name)).toStrictEqual(["Short answers exam"]);
  });
});

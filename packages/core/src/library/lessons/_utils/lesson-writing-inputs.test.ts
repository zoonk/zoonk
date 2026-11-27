import { randomUUID } from "node:crypto";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { examStructure } from "../../exams/_test-utils/exam-formats";
import {
  temperatureSpec,
  writtenTemperatureLesson,
} from "../../quality/_test-utils/written-lessons";
import { toStepContent } from "../../steps/written-screens";
import { toScreensToSave } from "./checked-version";
import {
  loadLessonWritingInputs,
  loadPublishedLessonInputs,
  toWritingContext,
} from "./lesson-writing-inputs";

describe(loadLessonWritingInputs, () => {
  it("keeps a later matching skill when a screen's first spec skill no longer matches a lesson link", async () => {
    const original = temperatureSpec();
    const specSkill = original.skills[0];

    if (!specSkill) {
      throw new Error("Expected a spec skill");
    }

    const spec = {
      ...original,
      screens: original.screens.map((screen, index) =>
        index === 3 ? { ...screen, skills: [0, 1] } : screen,
      ),
      skills: [
        specSkill,
        { ...specSkill, name: "Recognize a rise" },
        { ...specSkill, name: "Read below zero" },
      ],
    };

    const workflowRunId = randomUUID();

    const [lesson, first, matching] = await Promise.all([
      libraryLessonFixture({ contentRunId: workflowRunId, contentStatus: "running", spec }),
      skillFixture({ name: "Read a temperature change" }),
      skillFixture({ name: "Recognize a rise" }),
    ]);

    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: first.id }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: matching.id }),
    ]);

    const reserveExam = await examBlueprintFixture();

    await itemFixture({
      content: choiceItemContent("Which ice melts first?"),
      examBlueprintId: reserveExam.id,
      mockOnly: true,
      skillId: matching.id,
    });

    const state = await loadLessonWritingInputs({ lessonId: lesson.id, workflowRunId });
    expect(state.status).toBe("ready");

    if (state.status !== "ready") {
      return;
    }

    expect(toWritingContext(state.inputs).usedSituations).toContain("Which ice melts first?");

    const written = writtenTemperatureLesson();

    const screens = toScreensToSave({
      citations: [],
      inputs: state.inputs,
      screens: written.screens.map((screen) =>
        toStepContent(screen, { allowImage: false, language: "en" }),
      ),
      version: {
        lesson: written,
        provenanceByScreen: written.screens.map(() => ({
          generatedAt: new Date(),
          model: "test/fixture",
          promptVersion: "test-v1",
          runId: workflowRunId,
          sources: [],
        })),
      },
    });

    expect(screens[3]?.skillId).toBe(matching.id);
  });
});

describe(loadPublishedLessonInputs, () => {
  it("lets the writer and its checks write a typed answer only for learners whose exams ask one", async () => {
    const [user, blueprint, shortAnswerLesson, hobbyLesson] = await Promise.all([
      userFixture(),
      examBlueprintFixture({ structure: examStructure(["multipleChoice", "shortAnswer"]) }),
      libraryLessonFixture({ spec: temperatureSpec() }),
      libraryLessonFixture({ spec: temperatureSpec() }),
    ]);

    const [examGoal, hobbyGoal] = await Promise.all([
      goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const [examPlan, hobbyPlan] = await Promise.all([
      planFixture({ goalId: examGoal.id }),
      planFixture({ goalId: hobbyGoal.id }),
    ]);

    await Promise.all([
      planItemFixture({ lessonId: shortAnswerLesson.id, planId: examPlan.id, position: 0 }),
      planItemFixture({ lessonId: hobbyLesson.id, planId: hobbyPlan.id, position: 0 }),
    ]);

    const [shortAnswer, hobby] = await Promise.all([
      loadPublishedLessonInputs(shortAnswerLesson.id),
      loadPublishedLessonInputs(hobbyLesson.id),
    ]);

    expect(shortAnswer && toWritingContext(shortAnswer).shortAnswers).toBe(true);
    expect(hobby && toWritingContext(hobby).shortAnswers).toBe(false);
  });

  it("never lists the lesson's own questions as cases to avoid, only other lessons' and the bank's", async () => {
    const [lesson, otherLesson, skill] = await Promise.all([
      libraryLessonFixture({ spec: temperatureSpec() }),
      libraryLessonFixture({ spec: temperatureSpec() }),
      skillFixture(),
    ]);

    const [own, other] = await Promise.all([
      itemFixture({
        content: choiceItemContent("Which glass of ice melts first?"),
        skillId: skill.id,
      }),
      itemFixture({ content: choiceItemContent("Which puddle freezes first?"), skillId: skill.id }),
      itemFixture({ content: choiceItemContent("Which pond thaws first?"), skillId: skill.id }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ]);

    await Promise.all([
      libraryStepFixture({ itemId: own.id, kind: "check", lessonId: lesson.id, skillId: skill.id }),
      libraryStepFixture({
        itemId: other.id,
        kind: "check",
        lessonId: otherLesson.id,
        skillId: skill.id,
      }),
    ]);

    const inputs = await loadPublishedLessonInputs(lesson.id);
    const situations = new Set(inputs ? toWritingContext(inputs).usedSituations : []);

    expect(situations).toStrictEqual(
      new Set(["Which puddle freezes first?", "Which pond thaws first?"]),
    );
  });
});

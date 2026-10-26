import { randomUUID } from "node:crypto";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
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

    const state = await loadLessonWritingInputs({ lessonId: lesson.id, workflowRunId });
    expect(state.status).toBe("ready");

    if (state.status !== "ready") {
      return;
    }

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
        })),
      },
    });

    expect(screens[3]?.skillId).toBe(matching.id);
  });
});

describe(loadPublishedLessonInputs, () => {
  it("lets the writer and its checks write a typed answer only for learners whose exams ask one", async () => {
    const [user, blueprint, discursiveLesson, hobbyLesson] = await Promise.all([
      userFixture(),
      examBlueprintFixture({ structure: examStructure(["multipleChoice", "essay"]) }),
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
      planItemFixture({ lessonId: discursiveLesson.id, planId: examPlan.id, position: 0 }),
      planItemFixture({ lessonId: hobbyLesson.id, planId: hobbyPlan.id, position: 0 }),
    ]);

    const [discursive, hobby] = await Promise.all([
      loadPublishedLessonInputs(discursiveLesson.id),
      loadPublishedLessonInputs(hobbyLesson.id),
    ]);

    expect(discursive && toWritingContext(discursive).writtenAnswers).toBe(true);
    expect(hobby && toWritingContext(hobby).writtenAnswers).toBe(false);
  });
});

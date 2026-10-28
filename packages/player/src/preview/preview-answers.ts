import { type PlayableLibraryStep } from "@zoonk/core/lesson-player/contract";
import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type ActivityExpectedAnswer } from "@zoonk/core/library/activities/expected-answer";
import {
  type ActivityStepContent,
  getActivityTemplate,
} from "@zoonk/core/library/activities/templates";
import { type LessonPlayerAnswer } from "../lesson/lesson-player-types";

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

function patternSolution(content: ActivityStepContent): string | null {
  const { fields } = content;
  return "solution" in fields && typeof fields.solution === "string" ? fields.solution : null;
}

function interactionAnswer({
  content,
  expected,
}: {
  content: ActivityStepContent;
  expected: ActivityExpectedAnswer;
}): ActivityAnswer | null {
  switch (expected.kind) {
    case "assignment":
    case "curveShift":
    case "grid":
    case "links":
    case "order":
    case "output":
    case "selection":
      return expected;
    case "formula":
    case "regex": {
      const pattern = patternSolution(content);
      return pattern === null ? null : { kind: "pattern", pattern };
    }
    case "pitchClasses":
      return {
        kind: "notes",
        notes: expected.pitchClasses.map((pitch) => PITCH_NAMES[pitch] ?? "C"),
      };
    case "rhythm":
      return { kind: "rhythm", tapTimesMs: expected.tapTimesMs };
    case "rows":
      return { columns: expected.columns, kind: "rows", rows: expected.rows };
    case "molecule":
      return null;
    default:
      return null;
  }
}

function activityAnswer(content: ActivityStepContent): ActivityAnswer | null {
  const { check } = content;

  if (check.kind === "choice") {
    const correct = check.options.find((option) => option.isCorrect);
    return correct ? { kind: "choice", optionId: correct.id } : null;
  }

  if (check.kind === "numeric") {
    return { kind: "numeric", value: check.answer };
  }

  const expected = getActivityTemplate(content.template)?.computeExpected(content.fields) ?? null;
  return expected ? interactionAnswer({ content, expected }) : null;
}

export function rightAnswer(step: PlayableLibraryStep): LessonPlayerAnswer | null {
  if (step.kind === "activity") {
    const answer = activityAnswer(step.content);
    return answer ? { answer, kind: "activity" } : null;
  }

  if (step.kind === "typedAnswer") {
    return { kind: "typedAnswer", text: step.content.sampleAnswer };
  }

  if (step.kind === "check") {
    const correct = step.content.options.find((option) => option.isCorrect);
    return correct ? { kind: "check", optionId: correct.id } : null;
  }

  if (step.kind === "hook" && step.content.variant === "guess") {
    const correct = step.content.options.find((option) => option.isCorrect);
    return correct ? { kind: "hook", optionId: correct.id } : null;
  }

  return null;
}

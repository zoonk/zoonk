import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { type MockQuickChoice } from "../exams/mocks/mock-format-mix";
import {
  getExamChoiceFormat,
  getExamChoiceFormats,
  getExamFormats,
} from "../library/exams/exam-choice-format";
import { describeFormat } from "../library/exams/format-style";
import { type NoticeFormats } from "../library/exams/notice-formats";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { readGoalExamFormats } from "../library/exams/short-answers";

export type PlacementItemExam = {
  /** Null until the exam blueprint is linked. */
  blueprintId: string | null;
  name: string;
  /** Null when the notice does not specify an option count. */
  optionCount: number | null;
  /** Quoted past-paper examples; omitted when the picker does not load them. */
  pastQuestions?: string[];
  style: string;
};

/** One of the exam's one-pick formats a mock writes, in its own shape instead of the widest one's. */
export type PlacementChoice = MockQuickChoice & { style: string | null };

function toExamStyle({
  formats,
  scoring,
}: {
  formats: NoticeFormats["formats"];
  scoring: string | undefined;
}): string {
  return [...formats.map((format) => describeFormat(format)), scoring].filter(Boolean).join(" ");
}

function toOptionCount(formats: NoticeFormats): number | null {
  const choice = getExamChoiceFormat(formats);
  return choice?.kind === "multipleChoice" ? choice.options : null;
}

export function toItemExam(blueprint: ExamBlueprint): PlacementItemExam {
  const { structure } = readBlueprintContent(blueprint);

  return {
    blueprintId: blueprint.id,
    name: blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name,
    optionCount: toOptionCount(structure),
    style: toExamStyle({
      formats: getExamFormats(structure),
      scoring: structure.mock?.scoring.description,
    }),
  };
}

function toNoticeItemExam({ formats, name }: { formats: NoticeFormats; name: string }) {
  return {
    blueprintId: null,
    name,
    optionCount: toOptionCount(formats),
    style: toExamStyle({ formats: getExamFormats(formats), scoring: undefined }),
  };
}

export function getGoalItemExam(
  goal: Pick<Goal, "details" | "kind" | "title"> & { examBlueprint: ExamBlueprint | null },
): { exam: PlacementItemExam | null; formats: NoticeFormats | null } {
  const blueprint = goal.examBlueprint;
  const structure = blueprint ? readBlueprintContent(blueprint).structure : null;
  const formats = readGoalExamFormats({ goal, structure });

  if (blueprint) {
    return { exam: goal.kind === "exam" ? toItemExam(blueprint) : null, formats };
  }

  return { exam: formats ? toNoticeItemExam({ formats, name: goal.title }) : null, formats };
}

/** With a `choice`, the questions take that format's shape, and only questions in it count. */
export function getPickingExam({
  choice,
  goal,
}: {
  choice?: PlacementChoice;
  goal: Parameters<typeof getGoalItemExam>[0] | null;
}) {
  const { exam, formats } = goal ? getGoalItemExam(goal) : { exam: null, formats: null };

  if (!choice) {
    return { choices: getExamChoiceFormats(exam ? formats : null), exam, formats };
  }

  return {
    choices: [choice],
    exam: exam && {
      ...exam,
      optionCount: choice.options ?? exam.optionCount,
      style: choice.style ?? exam.style,
    },
    formats,
  };
}

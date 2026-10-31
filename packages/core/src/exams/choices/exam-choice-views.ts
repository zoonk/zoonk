import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectPoints } from "../../library/exams/subject-points";
import { getSubjectQuestions } from "../../library/exams/subject-questions";
import { findExamQuestions } from "../mocks/mock-structure";
import { type ExamChoiceView } from "./exam-choice-contract";
import {
  type ChoiceGroup,
  type ExamChoice,
  listChoiceGroups,
  toChosenStructure,
} from "./exam-choices";

type Subject = ExamStructure["subjects"][number];

function findOptionsTest({
  group,
  structure,
}: {
  group: ChoiceGroup<Subject>;
  structure: ExamStructure;
}): string | null {
  const [test, ...others] = new Set(group.options.map((option) => option.group ?? null));

  const isWhole =
    test &&
    others.length === 0 &&
    structure.subjects.every(
      (subject) => subject.group !== test || subject.choiceGroup === group.name,
    );

  return isWhole ? test : null;
}

function statesPoints(structure: ExamStructure): boolean {
  const scoring = structure.mock?.scoring;

  return (
    (scoring?.marking?.length ?? 0) > 0 ||
    (scoring?.parts ?? []).some((part) => part.maxPoints !== null)
  );
}

function sumPoints(structure: ExamStructure): number | null {
  const points = structure.subjects.map((subject) => getSubjectPoints({ structure, subject }));

  return points.every((point) => point !== null)
    ? Math.round(points.reduce<number>((sum, point) => sum + (point ?? 0), 0))
    : null;
}

/** Counted on the exam as a learner who picked an option takes it: every option is the same size. */
function describeLeftOut({
  group,
  structure,
}: {
  group: ChoiceGroup<Subject>;
  structure: ExamStructure;
}): ExamChoiceView["leftOut"] {
  const [first] = group.options;
  const counts = group.options.map((option) => getSubjectQuestions({ structure, subject: option }));

  const taken = first
    ? toChosenStructure({ choices: [{ group: group.name, subject: first.name }], structure })
    : structure;

  const option = taken.subjects.find((subject) => subject.name === first?.name);
  const counted = statesPoints(structure);

  const points = option && counted ? getSubjectPoints({ structure: taken, subject: option }) : null;

  return {
    examPoints: counted ? sumPoints(taken) : null,
    examQuestions:
      findExamQuestions({ noticeQuestions: null, structure: taken })?.questions ?? null,
    name: findOptionsTest({ group, structure }) ?? group.name,
    points: points === null ? null : Math.round(points),
    questions: counts.find((count) => count !== null) ?? null,
  };
}

export function listExamChoiceViews({
  choices,
  structure,
}: {
  choices: readonly ExamChoice[];
  structure: ExamStructure;
}): ExamChoiceView[] {
  return listChoiceGroups(structure.subjects).map((group) => {
    const choice = choices.find((item) => item.group === group.name);

    return {
      group: group.name,
      leftOut: describeLeftOut({ group, structure }),
      options: group.options.map((option) => ({
        name: option.name,
        shortName: option.shortName ?? null,
      })),
      subject: group.options.find((option) => option.name === choice?.subject)?.name ?? null,
    };
  });
}

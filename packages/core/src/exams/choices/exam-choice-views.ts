import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectPoints } from "../../library/exams/subject-points";
import { getSubjectQuestions } from "../../library/exams/subject-questions";
import { findExamQuestions } from "../mocks/mock-structure";
import { type ChoiceGroup, listChoiceGroups } from "./choice-groups";
import { type ExamChoiceView } from "./exam-choice-contract";
import { type ExamPicks, findChosenOptions, toChosenStructure } from "./exam-choices";
import { scopeExamStructure } from "./exam-scope";

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

function sumPoints({
  structure,
  subjects = structure.subjects,
}: {
  structure: ExamStructure;
  subjects?: readonly Subject[];
}): number | null {
  const points = subjects.map((subject) => getSubjectPoints({ structure, subject }));

  return points.every((point) => point !== null)
    ? Math.round(points.reduce<number>((sum, point) => sum + (point ?? 0), 0))
    : null;
}

/** Counted as a learner who picked the first `take` options takes it: every option is the same size. */
function describeLeftOut({
  group,
  structure,
}: {
  group: ChoiceGroup<Subject>;
  structure: ExamStructure;
}): ExamChoiceView["leftOut"] {
  const first = group.options.slice(0, group.take).map((option) => option.name);

  const stated = group.options.flatMap((option) => {
    const count = getSubjectQuestions({ structure, subject: option });
    return count === null ? [] : [count];
  });

  const counts = stated.slice(0, group.take);

  const taken = toChosenStructure({
    picks: { examChoices: [{ group: group.name, subjects: first }], examSubjects: [] },
    structure,
  });

  const options = taken.subjects.filter((subject) => first.includes(subject.name));
  const counted = statesPoints(structure);

  return {
    examPoints: counted ? sumPoints({ structure: taken }) : null,
    examQuestions:
      findExamQuestions({ noticeQuestions: null, structure: taken })?.questions ?? null,
    name: findOptionsTest({ group, structure }) ?? group.name,
    points: counted ? sumPoints({ structure: taken, subjects: options }) : null,
    questions: counts.length === group.take ? counts.reduce((sum, count) => sum + count, 0) : null,
  };
}

export function listExamChoiceViews({
  picks,
  structure: whole,
}: {
  picks: ExamPicks;
  structure: ExamStructure;
}): ExamChoiceView[] {
  const structure = scopeExamStructure({ examSubjects: picks.examSubjects, structure: whole });

  return listChoiceGroups(structure).map((group) => {
    const choice = picks.examChoices.find((item) => item.group === group.name);
    const chosen = choice ? findChosenOptions({ choice, structure }) : null;

    return {
      group: group.name,
      leftOut: describeLeftOut({ group, structure }),
      options: group.options.map((option) => ({
        name: option.name,
        shortName: option.shortName ?? null,
      })),
      subjects: (chosen ?? []).map((option) => option.name),
      take: group.take,
    };
  });
}

import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listExamChoiceViews } from "../choices/exam-choice-views";
import { type ExamChoice, listChoiceGroups } from "../choices/exam-choices";
import { findSubjectSections, getObjectiveSectionNames } from "./exam-parts";

type Subject = ExamStructure["subjects"][number];

/** `days` is empty when no section names the choice's subjects: it's then left out of every day. */
export type UnpickedChoice = { days: number[]; name: string };

function findAskedDays({
  options,
  structure,
}: {
  options: readonly Subject[];
  structure: ExamStructure;
}): number[] {
  const sections = getObjectiveSectionNames(structure);

  const asked = new Set(
    options.flatMap((subject) => findSubjectSections({ sections, structure, subject })),
  );

  return [
    ...new Set(
      (structure.mock?.sections ?? []).flatMap((section) =>
        asked.has(section.name) && section.day !== null ? [section.day] : [],
      ),
    ),
  ];
}

export function listUnpickedChoices({
  choices,
  structure,
}: {
  choices: readonly ExamChoice[];
  structure: ExamStructure;
}): UnpickedChoice[] {
  const groups = listChoiceGroups(structure.subjects);

  return listExamChoiceViews({ choices, structure }).flatMap((view) => {
    if (view.subject) {
      return [];
    }

    const options = groups.find((group) => group.name === view.group)?.options ?? [];
    return [{ days: findAskedDays({ options, structure }), name: view.leftOut.name }];
  });
}

export function listLeftOutChoices({
  day,
  kind,
  unpicked,
}: {
  day: number | null;
  kind: "area" | "full" | "half";
  unpicked: readonly UnpickedChoice[];
}): string[] {
  if (kind === "area") {
    return [];
  }

  return unpicked.flatMap((choice) =>
    day === null || choice.days.length === 0 || choice.days.includes(day) ? [choice.name] : [],
  );
}

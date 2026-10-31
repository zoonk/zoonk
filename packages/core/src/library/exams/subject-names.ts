import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { type ExamStructure } from "./blueprint-contract";

export function listSubjectNames({
  area,
  structure,
}: {
  area: string;
  structure: Pick<ExamStructure, "subjects"> | null;
}): string[] {
  const subjects = structure?.subjects ?? [];
  const index = matchAreasToSubjects({ areas: [area], subjects }).get(area);
  const subject = index === undefined ? undefined : subjects[index];
  const names = new Set([area]);

  function add(name: string | null | undefined): void {
    if (!name || names.has(name)) {
      return;
    }

    names.add(name);
    const parent = subjects.find((item) => item.name === name);

    if (parent) {
      add(parent.group);
      add(parent.partOf);
    }
  }

  if (subject) {
    add(subject.name);
    add(subject.group);
    add(subject.partOf);
  }

  return [...names];
}

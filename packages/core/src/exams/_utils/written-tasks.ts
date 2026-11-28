import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { namesMatch } from "./name-match";

export function subjectNamesSection(
  { group, name }: { group?: string | null; name: string },
  section: string,
): boolean {
  return namesMatch(section, name) || (typeof group === "string" && namesMatch(section, group));
}

export function getWrittenTaskOptions(structure: ExamStructure) {
  return (structure.mock?.sections ?? [])
    .filter((section) => section.kind === "written")
    .flatMap((section) =>
      (section.tasks ?? []).map((task) => ({
        description: task.description,
        section: section.name,
        subjects:
          task.subjects ??
          structure.subjects
            .filter((subject) => subjectNamesSection(subject, section.name))
            .map((subject) => subject.name),
      })),
    );
}

export function getWrittenTasks({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: ExamStructure["subjects"][number];
}): string[] {
  return getWrittenTaskOptions(structure)
    .filter((task) => task.subjects.includes(subject.name))
    .map((task) => task.description);
}

import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { namesMatch } from "./name-match";

export function subjectNamesSection(
  { group, name }: { group?: string | null; name: string },
  section: string,
): boolean {
  return namesMatch(section, name) || (typeof group === "string" && namesMatch(section, group));
}

export function getWrittenTasks({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: ExamStructure["subjects"][number];
}): string[] {
  return (structure.mock?.sections ?? [])
    .filter((section) => section.kind === "written" && subjectNamesSection(subject, section.name))
    .flatMap((section) => (section.tasks ?? []).map((task) => task.description));
}

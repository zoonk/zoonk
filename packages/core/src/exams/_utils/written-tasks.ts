import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { namesMatch } from "./name-match";

export function getWrittenTasks({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: ExamStructure["subjects"][number];
}): string[] {
  const names = [subject.name, subject.group].filter((name) => name !== undefined && name !== null);

  return (structure.mock?.sections ?? [])
    .filter(
      (section) =>
        section.kind === "written" && names.some((name) => namesMatch(section.name, name)),
    )
    .flatMap((section) => (section.tasks ?? []).map((task) => task.description));
}

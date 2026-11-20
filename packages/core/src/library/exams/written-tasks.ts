import { type ExamStructure } from "./blueprint-contract";

export function listWrittenTasks({
  structure,
  day,
}: {
  structure: ExamStructure;
  day?: number | null;
}) {
  return (structure.mock?.sections ?? [])
    .filter((section) => section.kind === "written" && (day === undefined || section.day === day))
    .flatMap((section) =>
      (section.tasks ?? []).flatMap((task) =>
        task.key
          ? [
              {
                count: task.count,
                description: task.description,
                grading: task.grading ?? null,
                handwritten: task.handwritten ?? null,
                key: task.key,
                lines: task.lines ?? null,
                minutes: section.minutes,
                points: task.points ?? null,
                section: section.name,
                session: section.session ?? null,
              },
            ]
          : [],
      ),
    );
}

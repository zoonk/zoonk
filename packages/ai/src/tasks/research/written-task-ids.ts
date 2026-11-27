import { type BlueprintExtraction } from "./extract-exam-blueprint";

type Section = NonNullable<BlueprintExtraction["mock"]>["sections"][number];
type Task = Section["tasks"][number];

export function listWrittenTasks(extraction: BlueprintExtraction) {
  return (extraction.mock?.sections ?? []).flatMap((section, sectionIndex) =>
    section.kind === "written"
      ? section.tasks.map((task, taskIndex) => ({
          id: `${sectionIndex + 1}.${taskIndex + 1}`,
          section,
          task,
        }))
      : [],
  );
}

export function updateWrittenTasks({
  extraction,
  update,
}: {
  extraction: BlueprintExtraction;
  update: (task: Task, id: string) => Task;
}): BlueprintExtraction {
  if (!extraction.mock) {
    return extraction;
  }

  const ids = new Map(listWrittenTasks(extraction).map(({ id, task }) => [task, id]));

  return {
    ...extraction,
    mock: {
      ...extraction.mock,
      sections: extraction.mock.sections.map((section) => ({
        ...section,
        tasks: section.tasks.map((task) => {
          const id = ids.get(task);
          return id ? update(task, id) : task;
        }),
      })),
    },
  };
}

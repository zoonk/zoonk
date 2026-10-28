import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type ListeningPlays } from "../../library/listening/listening-content";

const MAX_PART_QUESTIONS = 10;

const DEFAULT_PART_QUESTIONS = 6;

/** When the notice is silent, allow a second play so learners never lose a permitted replay. */
const DEFAULT_PLAYS: ListeningPlays = 2;

export type ListeningPart = {
  count: number;
  plays: ListeningPlays;
  sectionName: string;
  task: string;
};

function toPlays(plays: number | null | undefined): ListeningPlays {
  return plays === 1 || plays === 2 ? plays : DEFAULT_PLAYS;
}

function toCount(count: number | null): number {
  return Math.min(count ?? DEFAULT_PART_QUESTIONS, MAX_PART_QUESTIONS);
}

export function listListeningParts(structure: Pick<ExamStructure, "mock">): ListeningPart[] {
  const sections = (structure.mock?.sections ?? []).filter(
    (section) => section.kind === "listening",
  );

  return sections.flatMap((section): ListeningPart[] => {
    const tasks = section.tasks ?? [];

    if (tasks.length === 0) {
      return [
        {
          count: toCount(section.questions),
          plays: DEFAULT_PLAYS,
          sectionName: section.name,
          task: section.name,
        },
      ];
    }

    return tasks.map((task, index) => ({
      count: toCount(task.count),
      plays: toPlays(task.plays),
      sectionName: section.name,
      task: task.description || `${section.name}, part ${index + 1} of ${tasks.length}`,
    }));
  });
}

import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type ListeningPlays } from "../../library/listening/listening-content";

/** The most questions one recording gets: a set is one recording and the questions on it. */
const MAX_PART_QUESTIONS = 10;

/** Questions in a listening part when the notice gives neither its parts nor the section's count. */
const DEFAULT_PART_QUESTIONS = 6;

/**
 * Plays when the notice doesn't say. Exams split between once (IELTS, TOEFL) and twice (Cambridge,
 * DELE), and a second play costs a learner nothing they'd get in the real exam, while a missing one
 * costs them a recording they could have answered.
 */
const DEFAULT_PLAYS: ListeningPlays = 2;

/** One recording of an exam's listening paper, as practice and mocks ask it. */
export type ListeningPart = {
  /** The part's questions, at most one set's. */
  count: number;
  plays: ListeningPlays;
  sectionName: string;
  /**
   * The recording and its questions in the notice's words, or the section's name (and the part's
   * number when the notice's description of it wasn't kept) otherwise: what the set's writer
   * follows, and how the part's stored sets are found.
   */
  task: string;
};

function toPlays(plays: number | null | undefined): ListeningPlays {
  return plays === 1 || plays === 2 ? plays : DEFAULT_PLAYS;
}

function toCount(count: number | null): number {
  return Math.min(count ?? DEFAULT_PART_QUESTIONS, MAX_PART_QUESTIONS);
}

/**
 * The recordings of the exam's listening sections, in the exam's order: each part the notice lists
 * (its questions, what's heard and how many times it's played), or one part per section when it
 * lists none. Empty for an exam without a listening section.
 */
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

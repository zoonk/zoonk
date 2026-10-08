/**
 * Another lesson of the chapter a lesson is planned or written for, so the lesson adds something
 * new instead of teaching the same idea with the same example, numbers or question again. What
 * exists at that moment is enough: an outlined lesson has only its title and can-do line.
 */
export type ChapterLesson = {
  title: string;
  canDo?: string;
  /** `before`: the learner meets it before this lesson. `after`: it comes next. */
  order: "after" | "before";
  /** What it teaches: its summary card once written, its planned skills before that. */
  ideas?: string[];
  /** The cases, numbers and questions it uses: its screens once written, its plan before that. */
  examples?: string[];
};

const ORDER_LABELS: Record<ChapterLesson["order"], string> = {
  after: "Taught next",
  before: "Already taught",
};

function formatItems(label: string, items: readonly string[] = []): string[] {
  return items.length === 0 ? [] : [`  ${label}:`, ...items.map((item) => `    - ${item}`)];
}

function formatLesson(lesson: ChapterLesson): string {
  return [
    `- ${ORDER_LABELS[lesson.order]}: ${lesson.title}`,
    lesson.canDo ? `  Can do: ${lesson.canDo}` : null,
    ...formatItems("Ideas", lesson.ideas),
    ...formatItems("Examples", lesson.examples),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** The chapter's other lessons in teaching order, as `CHAPTER_LESSONS` reads them. */
export function formatChapterLessons(lessons: readonly ChapterLesson[] = []): string {
  return lessons.length === 0
    ? "none"
    : `\n${lessons.map((lesson) => formatLesson(lesson)).join("\n")}`;
}

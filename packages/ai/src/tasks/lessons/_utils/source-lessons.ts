export type SourceLesson = { title: string; description: string };

/**
 * Source lessons can come from planned rows that are not generated yet, so
 * each row should omit empty title or description fields instead of producing
 * awkward prompt text such as `": description"`.
 */
function formatSourceLesson({ index, lesson }: { index: number; lesson: SourceLesson }) {
  const prefix = `${index + 1}.`;

  if (lesson.title && lesson.description) {
    return `${prefix} ${lesson.title}: ${lesson.description}`;
  }

  if (lesson.title) {
    return `${prefix} ${lesson.title}`;
  }

  return `${prefix} ${lesson.description}`;
}

/**
 * Generated lesson prompts need source scope without waiting for generated
 * content. Titles and descriptions keep prompt context compact and stable.
 */
export function formatSourceLessonsForPrompt(sourceLessons: SourceLesson[]) {
  return sourceLessons.map((lesson, index) => formatSourceLesson({ index, lesson })).join("\n");
}

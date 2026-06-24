export type SourceLesson = { title: string; description: string };

/**
 * Source lessons can come from planned rows that are not generated yet, so
 * each row should omit empty title or description fields instead of producing
 * awkward prompt text such as `": description"`.
 */
function formatSourceLessonText(lesson: SourceLesson) {
  if (lesson.title && lesson.description) {
    return `${lesson.title}: ${lesson.description}`;
  }

  if (lesson.title) {
    return lesson.title;
  }

  return lesson.description;
}

/**
 * Single-source prompts should read like one lesson brief, not a numbered list.
 */
export function formatSourceLessonForPrompt(lesson: SourceLesson) {
  return formatSourceLessonText(lesson);
}

/**
 * Multi-source prompts keep numbering so the model can distinguish each lesson
 * brief without extra prose around the input.
 */
function formatSourceLesson({ index, lesson }: { index: number; lesson: SourceLesson }) {
  return `${index + 1}. ${formatSourceLessonText(lesson)}`;
}

/**
 * Generated lesson prompts need source scope without waiting for generated
 * content. Titles and descriptions keep prompt context compact and stable.
 */
export function formatSourceLessonsForPrompt(sourceLessons: SourceLesson[]) {
  return sourceLessons.map((lesson, index) => formatSourceLesson({ index, lesson })).join("\n");
}

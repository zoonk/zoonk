export type SourceLesson = { title: string; description: string };

/**
 * Source lessons can come from incomplete user drafts, so each row should omit
 * empty title or description fields instead of producing awkward prompt text
 * such as `": description"`.
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
 * Core practice and quiz prompts need the covered lesson scope without sending
 * every generated explanation step. Titles and descriptions keep the prompt
 * compact while still telling the model which concepts the lesson must cover.
 */
export function formatSourceLessonsForPrompt(sourceLessons: SourceLesson[]) {
  return sourceLessons.map((lesson, index) => formatSourceLesson({ index, lesson })).join("\n");
}

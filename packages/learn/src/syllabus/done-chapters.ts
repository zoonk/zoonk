import { type SyllabusChapter } from "@zoonk/core/view-models/syllabus/contract";

export function getDoneChapters<Chapter extends Pick<SyllabusChapter, "state">>(
  chapters: readonly Chapter[],
): Chapter[] {
  return chapters.filter((chapter) => chapter.state === "done");
}

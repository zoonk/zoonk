import {
  publishStagedLessonVersion,
  stageLessonVersion,
} from "../library/lessons/_utils/save-lesson-content";

export async function publishLessonVersion(
  input: Parameters<typeof stageLessonVersion>[0],
): Promise<number | null> {
  const version = await stageLessonVersion(input);

  return version === null
    ? null
    : publishStagedLessonVersion({ lessonId: input.lessonId, version });
}

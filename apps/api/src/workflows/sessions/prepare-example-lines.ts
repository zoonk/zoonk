import {
  listExampleLineLessonsStep,
  pickExampleLineFactsStep,
  writeLessonExampleLinesStep,
} from "./steps/example-lines-steps";

/** Writes the learner's example lines for the lessons ahead, so a lesson opens with them ready. */
export async function prepareExampleLines({
  lessonIds,
  userId,
}: {
  lessonIds: string[];
  userId: string;
}): Promise<void> {
  const lessons = await listExampleLineLessonsStep({ lessonIds, userId });

  if (lessons.length === 0) {
    return;
  }

  const picked = await pickExampleLineFactsStep({ userId });

  if (!picked) {
    return;
  }

  for (const lessonId of lessons) {
    // oxlint-disable-next-line no-await-in-loop -- Each lesson's lines are written knowing the earlier lessons' lines, so no two tell the same moment.
    await writeLessonExampleLinesStep({ lessonId, picked, userId });
  }
}

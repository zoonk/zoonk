import "server-only";
import { getLessonGenerationStates } from "../../../library/generation/lesson-generation-state";
import { withLessonScreens } from "../../../sessions/_utils/lesson-screens";
import { type ReadStudyDay } from "../../../sessions/_utils/read-study-day";

/** The day as Today shows it: each lesson block with where it plays. */
export async function readDaySession(day: ReadStudyDay) {
  const lessonIds = day.session.blocks.flatMap((block) =>
    block.kind === "learn" && block.lessonId ? [block.lessonId] : [],
  );

  const lessonStates = await getLessonGenerationStates(lessonIds);

  return {
    lessonStates,
    session: withLessonScreens(day.session, lessonStates, { saved: day.selection === null }),
  };
}

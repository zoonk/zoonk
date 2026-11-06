import { completeLessonContent } from "@zoonk/core/library/generation/state";
import { readLessonMarking } from "@zoonk/core/library/marks/tag";
import { isRunActive } from "../../_shared/run-activity";

export type MarksAndPictures = { drawn: boolean; marked: boolean };

/** The icons come from tagging, so they've all settled only once the marks run has ended too. */
export async function readMarksAndPicturesStep({
  lessonId,
  marksRunId,
  picturesRunId,
}: {
  lessonId: string;
  marksRunId: string;
  picturesRunId: string;
}): Promise<MarksAndPictures> {
  "use step";

  const [marking, marksRunning, picturesRunning] = await Promise.all([
    readLessonMarking(lessonId),
    isRunActive(marksRunId),
    isRunActive(picturesRunId),
  ]);

  return {
    drawn: !marksRunning && !picturesRunning && !marking.drawingIcons,
    marked: marking.tagged || !marksRunning,
  };
}

export async function completeLessonContentStep(input: {
  lessonId: string;
  workflowRunId: string;
}): Promise<boolean> {
  "use step";

  return completeLessonContent(input);
}

import { type CallWait } from "@zoonk/ai/provider-options";
import { PICTURE_WAIT_MS } from "@zoonk/core/lesson-player/picture-wait";
import { sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import { lessonImagesWorkflow } from "../images/lesson-images-workflow";
import { lessonMarksWorkflow } from "../marks/lesson-marks-workflow";
import { lessonProgressStep } from "./steps/lesson-progress-step";
import { type MarksAndPictures, readMarksAndPicturesStep } from "./steps/lesson-ready-steps";
import { type ImageScope } from "./steps/write-lesson-content-step";

const SETTLE_POLL_MS = 5000;
const MAX_SETTLE_POLLS = PICTURE_WAIT_MS / SETTLE_POLL_MS;

async function reportSettled({
  lessonId,
  previous,
  settled,
}: {
  lessonId: string;
  previous?: MarksAndPictures;
  settled: MarksAndPictures;
}): Promise<void> {
  await Promise.all([
    settled.marked && !previous?.marked
      ? lessonProgressStep({ entityId: lessonId, status: "completed", step: "markLesson" })
      : null,
    settled.drawn && !previous?.drawn
      ? lessonProgressStep({ entityId: lessonId, status: "completed", step: "drawPictures" })
      : null,
  ]);
}

/** When the screens' picture wait ends, the lesson opens with what it has, so a stuck drawing never holds a learner. */
export async function markAndDraw({
  analytics,
  imageScope,
  lessonId,
  wait,
}: {
  analytics?: ContentAnalytics;
  imageScope: NonNullable<ImageScope>;
  lessonId: string;
  wait?: CallWait;
}): Promise<void> {
  // Workflow code reads the run's logical clock, the same on every replay.
  const opensAt = Date.now() + PICTURE_WAIT_MS;

  const [marks, pictures] = await Promise.all([
    start(lessonMarksWorkflow, [{ analytics, lessonId, wait }]),
    start(lessonImagesWorkflow, [
      { analytics: { ...analytics, contentScope: imageScope }, lessonId },
    ]),
    lessonProgressStep({ entityId: lessonId, status: "started", step: "markLesson" }),
    lessonProgressStep({ entityId: lessonId, status: "started", step: "drawPictures" }),
  ]);

  const runs = { lessonId, marksRunId: marks.runId, picturesRunId: pictures.runId };

  const last = await repeatUntil<MarksAndPictures>({
    done: (settled) => (settled.marked && settled.drawn) || Date.now() >= opensAt,
    run: async (previous) => {
      await sleep(SETTLE_POLL_MS);
      const settled = await readMarksAndPicturesStep(runs);
      await reportSettled({ lessonId, previous, settled });
      return settled;
    },
    times: MAX_SETTLE_POLLS,
  });

  await reportSettled({ lessonId, previous: last, settled: { drawn: true, marked: true } });
}

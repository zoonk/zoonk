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

/** When the screens' picture wait ends, the lesson or its fixed version goes live with what it has, so a stuck drawing never holds a learner. */
export async function markAndDraw({
  analytics,
  imageScope,
  lessonId,
  // Workflow code reads the run's logical clock, the same on every replay.
  savedAt = Date.now(),
  wait,
}: {
  analytics?: ContentAnalytics;
  imageScope: NonNullable<ImageScope>;
  lessonId: string;
  savedAt?: number;
  wait?: CallWait;
}): Promise<void> {
  const opensAt = savedAt + PICTURE_WAIT_MS;

  const [marks, pictures] = await Promise.all([
    start(lessonMarksWorkflow, [{ analytics, lessonId, wait }]),
    start(lessonImagesWorkflow, [
      { analytics: { ...analytics, contentScope: imageScope }, lessonId },
    ]),
    lessonProgressStep({ entityId: lessonId, status: "started", step: "markLesson" }),
    lessonProgressStep({ entityId: lessonId, status: "started", step: "drawPictures" }),
  ]);

  const runs = { lessonId, marksRunId: marks.runId, picturesRunId: pictures.runId };
  const deadline = sleep(new Date(opensAt));
  const read = (previous?: MarksAndPictures) => readSettled({ lessonId, previous, runs });

  // A failed child settles the wait as an ended one does.
  const afterMarks = await Promise.race([marks.returnValue.catch(() => null), deadline]).then(() =>
    read(),
  );

  const afterPictures = await Promise.race([pictures.returnValue.catch(() => null), deadline]).then(
    () => read(afterMarks),
  );

  const done = (settled: MarksAndPictures) =>
    (settled.marked && settled.drawn) || Date.now() >= opensAt;

  // Both runs ended, but an icon another lesson's run draws can still be drawing.
  const last = done(afterPictures)
    ? afterPictures
    : await repeatUntil<MarksAndPictures>({
        done,
        run: async (previous = afterPictures) => {
          await sleep(SETTLE_POLL_MS);
          return read(previous);
        },
        times: MAX_SETTLE_POLLS,
      });

  await reportSettled({ lessonId, previous: last, settled: { drawn: true, marked: true } });
}

async function readSettled({
  lessonId,
  previous,
  runs,
}: {
  lessonId: string;
  previous?: MarksAndPictures;
  runs: Parameters<typeof readMarksAndPicturesStep>[0];
}): Promise<MarksAndPictures> {
  const settled = await readMarksAndPicturesStep(runs);
  await reportSettled({ lessonId, previous, settled });
  return settled;
}

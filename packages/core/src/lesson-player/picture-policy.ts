import { type StepKind } from "@zoonk/db";
import { getStepImageRequest } from "../library/media/_utils/step-image-request";

/** Pictures may arrive for five minutes after their screen was written, including retries. */
const PICTURE_WAIT_MS = 300_000;

export function isPicturePending({ now, startedAt }: { now: number; startedAt: number }): boolean {
  return now - startedAt < PICTURE_WAIT_MS;
}

type ScreenContent = { content: unknown; kind: StepKind };

/** A question keyed to the numbers of its picture ("which number is the ovary?"). */
function asksNumberedPicture({ content, kind }: ScreenContent): boolean {
  return kind !== "explanation" && Boolean(getStepImageRequest({ content, kind })?.parts);
}

/** Only questions keyed to numbers in a missing picture must be omitted; reading keeps its words. */
export function shouldOmitNumberedPicture({
  content,
  imageAvailable,
  imagePending,
  kind,
}: ScreenContent & { imageAvailable: boolean; imagePending: boolean }): boolean {
  return !imageAvailable && !imagePending && asksNumberedPicture({ content, kind });
}

/**
 * A question keyed to a numbered picture is part of a run when its picture was there for the
 * player: when the run started, or within its wait. The player leaves it out once its wait ends
 * without it, so a picture that comes later makes it optional in that run, and never brings it back
 * after the learner finished; the next run asks it. `pictureAt` is when this screen gained its
 * current image link, even when that image was drawn earlier and reused.
 */
export function isPictureLateForRun({
  content,
  kind,
  pictureAt,
  runStartedAt,
  waitStartedAt,
}: ScreenContent & { pictureAt: number; runStartedAt: number; waitStartedAt: number }): boolean {
  return (
    asksNumberedPicture({ content, kind }) &&
    pictureAt > Math.max(runStartedAt, waitStartedAt + PICTURE_WAIT_MS)
  );
}

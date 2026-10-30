import { type StepKind } from "@zoonk/db";
import { getStepImageRequest } from "../library/media/_utils/step-image-request";

/** Include generation retries within the five-minute picture wait. */
const PICTURE_WAIT_MS = 300_000;

export function isPicturePending({ now, startedAt }: { now: number; startedAt: number }): boolean {
  return now - startedAt < PICTURE_WAIT_MS;
}

type ScreenContent = { content: unknown; kind: StepKind };

export function asksNumberedPicture({ content, kind }: ScreenContent): boolean {
  return kind !== "explanation" && Boolean(getStepImageRequest({ content, kind })?.parts);
}

/** Only numbered-picture questions are omitted; explanations retain their text. */
export function shouldOmitNumberedPicture({
  content,
  imageAvailable,
  imagePending,
  kind,
}: ScreenContent & { imageAvailable: boolean; imagePending: boolean }): boolean {
  return !imageAvailable && !imagePending && asksNumberedPicture({ content, kind });
}

/** pictureAt is this screen's link-arrival time, not asset generation time; images arriving after the run's wait remain optional. */
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

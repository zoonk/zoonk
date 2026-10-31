import { type MediaAsset, type Step, type StepKind, type StepOptionPicture } from "@zoonk/db";
import {
  getOptionPictureRequests,
  getStepImageRequest,
} from "../../library/media/_utils/step-image-request";
import {
  isPictureLateForRun,
  isPicturePending,
  shouldOmitNumberedPicture,
} from "../picture-policy";
import { type PlayableStepImage } from "../playable-lesson";

type PictureRow = {
  generatedAt: Date;
  mediaAsset: MediaAsset | null;
  optionPictures?: (StepOptionPicture & { mediaAsset: MediaAsset })[];
};

export function getStepImage({
  content,
  kind,
  mediaAsset,
}: {
  content: unknown;
  kind: StepKind;
  mediaAsset: MediaAsset | null;
}): PlayableStepImage | null {
  const request = mediaAsset?.kind === "image" ? getStepImageRequest({ content, kind }) : null;

  if (!mediaAsset || !request) {
    return null;
  }

  return {
    alt: request.alt,
    height: mediaAsset.height,
    id: mediaAsset.id,
    url: mediaAsset.url,
    width: mediaAsset.width,
  };
}

export function getOptionPictures({
  content,
  kind,
  pictures,
}: {
  content: unknown;
  kind: StepKind;
  pictures: readonly (StepOptionPicture & { mediaAsset: MediaAsset })[];
}): Record<string, PlayableStepImage> {
  const byOption = new Map(pictures.map((picture) => [picture.optionId, picture.mediaAsset]));

  return Object.fromEntries(
    getOptionPictureRequests({ content, kind }).flatMap((request) => {
      const asset = byOption.get(request.optionId);

      return asset?.kind === "image"
        ? [
            [
              request.optionId,
              {
                alt: request.alt,
                height: asset.height,
                id: asset.id,
                url: asset.url,
                width: asset.width,
              },
            ],
          ]
        : [];
    }),
  );
}

/** Questions keyed by numbered pictures cannot play without them; explanations may retain their text. */
function withoutLostNumberedPicture<TContent extends object>({
  content,
  image,
  imagePending,
  kind,
}: {
  content: TContent;
  image: PlayableStepImage | null;
  imagePending: boolean;
  kind: StepKind;
}): TContent | null {
  const request = getStepImageRequest({ content, kind });

  if (shouldOmitNumberedPicture({ content, imageAvailable: image !== null, imagePending, kind })) {
    return null;
  }

  return kind === "explanation" && !image && !imagePending && request?.parts
    ? { ...content, explore: undefined }
    : content;
}

/** Null content marks an unavailable numbered-picture question; pending means a recently requested picture is still expected. */
export function getScreenPictures<TContent extends object>({
  content,
  kind,
  row,
}: {
  content: TContent;
  kind: StepKind;
  row: PictureRow;
}) {
  const image = getStepImage({ content, kind, mediaAsset: row.mediaAsset });
  const optionPictures = getOptionPictures({ content, kind, pictures: row.optionPictures ?? [] });

  const missing =
    (!image && getStepImageRequest({ content, kind }) !== null) ||
    getOptionPictureRequests({ content, kind }).length > Object.keys(optionPictures).length;

  const pictureWaitStartedAt = row.generatedAt.getTime();

  const imagePending =
    missing && isPicturePending({ now: Date.now(), startedAt: pictureWaitStartedAt });

  return {
    content: withoutLostNumberedPicture({ content, image, imagePending, kind }),
    image,
    imagePending,
    optionPictures,
    pictureWaitStartedAt,
  };
}

/** Arrival times distinguish late pictures from unrelated edits; historical links without arrival times remain required. */
export function getLatePictureStepIds({
  rows,
  runStartedAt,
}: {
  rows: readonly Pick<
    Step,
    "content" | "generatedAt" | "id" | "kind" | "mediaAssetId" | "pictureAvailableAt"
  >[];
  runStartedAt: Date;
}): Set<string> {
  return new Set(
    rows
      .filter(
        (row) =>
          row.mediaAssetId !== null &&
          row.pictureAvailableAt !== null &&
          isPictureLateForRun({
            content: row.content,
            kind: row.kind,
            pictureAt: row.pictureAvailableAt.getTime(),
            runStartedAt: runStartedAt.getTime(),
            waitStartedAt: row.generatedAt.getTime(),
          }),
      )
      .map((row) => row.id),
  );
}

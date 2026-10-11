import { type MediaAsset, type StepKind, type StepOptionPicture } from "@zoonk/db";
import {
  getOptionPictureRequests,
  getStepImageRequest,
} from "../../library/media/_utils/step-image-request";
import { type PlayableStepImage } from "../contract";

/**
 * How long after a screen is written its picture may still be on its way: pictures are drawn in
 * the background right after the lesson opens, usually in under a minute, with one retry.
 */
const PICTURE_WAIT_MS = 300_000;

/** What a screen's pictures are read from: its linked files and when it was written. */
type PictureRow = {
  generatedAt: Date;
  mediaAsset: MediaAsset | null;
  optionPictures?: (StepOptionPicture & { mediaAsset: MediaAsset })[];
};

/**
 * The image file is linked through the step; its alt text comes from the step's picture request
 * (its `image`, or a labeled diagram's picture).
 */
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

/**
 * The drawn pictures of a question whose options are pictures, by option id, each with its
 * option's description as its alt text. Options asking for no picture have none.
 */
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

/**
 * A screen whose answer key is a numbered picture's (a labeled diagram, "which number is the
 * left ventricle?") can't be played once that picture is gone, taken out of use after its check
 * rejected it, or never drawn: the screen is left out, and an explanation shows its words without
 * the diagram to explore. While the picture is on its way, the screen waits for it.
 */
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

  if (image || imagePending || !request?.parts) {
    return content;
  }

  return kind === "explanation" ? { ...content, explore: undefined } : null;
}

/**
 * A screen's pictures: its own and its options' as drawn, whether the player still waits on one
 * (a picture the screen asks for, not drawn yet, on a screen written moments ago; past that, one
 * that never came stays out), and its content, null when it asks about a numbered picture it no
 * longer has.
 */
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

  const imagePending = missing && Date.now() - row.generatedAt.getTime() < PICTURE_WAIT_MS;

  return {
    content: withoutLostNumberedPicture({ content, image, imagePending, kind }),
    image,
    imagePending,
    optionPictures,
  };
}

import {
  isPicturePending,
  shouldOmitNumberedPicture,
} from "@zoonk/core/lesson-player/picture-policy";
import { type PlayableLibraryStep, type PlayableStepImage } from "../lesson-player-types";

export type PicturesState = {
  /** Pictures drawn after the lesson opened, by screen (`pictureKey`). */
  drawn: Readonly<Record<string, PlayableStepImage>>;
  /** Missing pictures whose original generation deadline has not passed, by picture key. */
  pending: readonly string[];
};

/** Where a picture is kept: its screen, or one option of its screen's question. */
export function pictureKey(stepId: string, optionId?: string): string {
  return optionId ? `${stepId}:${optionId}` : stepId;
}

/** The options of a question whose options are pictures, by id. */
export function pictureOptionIds(step: PlayableLibraryStep): string[] {
  if (step.kind !== "check") {
    return [];
  }

  return step.content.options.flatMap((option) => (option.picture ? [option.id] : []));
}

/** Every picture a screen still waits on: its own, or its picture options' missing ones. */
export function getPendingKeys(steps: readonly PlayableLibraryStep[]): string[] {
  return steps.flatMap((step) => {
    if (!("imagePending" in step) || !step.imagePending) {
      return [];
    }

    const options = pictureOptionIds(step);

    const drawn = step.optionPictures ?? {};

    return [
      ...(!step.image && getImageRequest(step) ? [step.id] : []),
      ...options.filter((id) => !drawn[id]).map((id) => pictureKey(step.id, id)),
    ];
  });
}

export function getWaitingKeys({
  drawn,
  now,
  startedAt,
  steps,
}: {
  drawn: PicturesState["drawn"];
  now: number;
  startedAt: number;
  steps: readonly PlayableLibraryStep[];
}): string[] {
  return steps.flatMap((step) => {
    if (
      !("imagePending" in step) ||
      !isPicturePending({ now, startedAt: step.pictureWaitStartedAt ?? startedAt })
    ) {
      return [];
    }

    return getPendingKeys([step]).filter((key) => !drawn[key]);
  });
}

/** Screens asking about a numbered picture that never came: nobody can play them without it. */
export function getLostNumberedScreens({
  drawn,
  pending,
  steps,
}: {
  drawn: PicturesState["drawn"];
  pending: PicturesState["pending"];
  steps: readonly PlayableLibraryStep[];
}): string[] {
  return steps.flatMap((step) =>
    "content" in step &&
    shouldOmitNumberedPicture({
      content: step.content,
      imageAvailable: Boolean(step.image ?? drawn[step.id]),
      imagePending: pending.includes(step.id),
      kind: step.kind,
    })
      ? [step.id]
      : [],
  );
}

/** The labeled diagram a screen asks about, or shows to explore on an explanation. */
export function labeledDiagramOf(step: PlayableLibraryStep) {
  if (step.kind === "explanation") {
    const { explore } = step.content;
    return explore?.template === "labeledDiagram" ? explore : null;
  }

  return step.kind === "activity" && step.content.template === "labeledDiagram"
    ? step.content
    : null;
}

/**
 * The picture a screen asks for: its own `image`, or the numbered picture of a labeled diagram it
 * asks about or shows to explore.
 */
export function getImageRequest(step: PlayableLibraryStep): { alt: string } | null {
  if (!("content" in step)) {
    return null;
  }

  const labeled = labeledDiagramOf(step);

  if (labeled) {
    return { alt: labeled.fields.picture.alt };
  }

  const { content } = step;
  const image = "image" in content ? content.image : null;
  return image && typeof image === "object" && "alt" in image ? { alt: image.alt } : null;
}

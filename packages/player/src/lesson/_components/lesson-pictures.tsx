"use client";

import { type LessonPicture } from "@zoonk/core/lesson-player/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { ImageIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Activity, createContext, use, useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  type LessonPlayerAdapters,
  type PlayableLibraryStep,
  type PlayableStepImage,
} from "../lesson-player-types";
import { type LessonPictureFrame, LessonStepImage, PICTURE_FRAME_CLASS } from "./lesson-step-image";

/** How often the player asks for pictures still being drawn. */
const POLL_MS = 4000;

/**
 * How long the player waits for a picture before showing the screen without it: drawing one takes
 * about a minute, two when its first try fails the check.
 */
const MAX_WAIT_MS = 150_000;

type PicturesState = {
  /** Pictures drawn after the lesson opened, by screen (`pictureKey`). */
  drawn: Readonly<Record<string, PlayableStepImage>>;
  /** No more waiting: every pending picture arrived, or the wait ran out. */
  settled: boolean;
};

const LessonPicturesContext = createContext<PicturesState>({ drawn: {}, settled: true });

/** Where a picture is kept: its screen, or one option of its screen's question. */
function pictureKey(stepId: string, optionId?: string): string {
  return optionId ? `${stepId}:${optionId}` : stepId;
}

/** The options of a question whose options are pictures, by id. */
function pictureOptionIds(step: PlayableLibraryStep): string[] {
  if (step.kind !== "check") {
    return [];
  }

  return step.content.options.flatMap((option) => (option.picture ? [option.id] : []));
}

/** Every picture a screen still waits on: its own, or its picture options' missing ones. */
function getPendingKeys(steps: readonly PlayableLibraryStep[]): string[] {
  return steps.flatMap((step) => {
    if (!("imagePending" in step) || !step.imagePending) {
      return [];
    }

    const options = pictureOptionIds(step);

    if (options.length > 0) {
      const drawn = step.optionPictures ?? {};
      return options.filter((id) => !drawn[id]).map((id) => pictureKey(step.id, id));
    }

    return step.image ? [] : [step.id];
  });
}

/** Whether a screen's answer key is its picture's numbers: a labeled diagram, or "which number…?". */
function asksAboutNumbers(step: PlayableLibraryStep): boolean {
  if (step.kind === "check") {
    return Boolean(step.content.image?.parts);
  }

  return step.kind === "activity" && labeledDiagramOf(step) !== null;
}

/** Screens asking about a numbered picture that never came: nobody can play them without it. */
function getLostNumberedScreens({
  drawn,
  steps,
}: {
  drawn: PicturesState["drawn"];
  steps: readonly PlayableLibraryStep[];
}): string[] {
  return steps.flatMap((step) =>
    asksAboutNumbers(step) &&
    "imagePending" in step &&
    step.imagePending &&
    !step.image &&
    !drawn[step.id]
      ? [step.id]
      : [],
  );
}

function toDrawn(pictures: readonly LessonPicture[]): Record<string, PlayableStepImage> {
  return Object.fromEntries(
    pictures.map((picture) => [pictureKey(picture.stepId, picture.optionId), picture.image]),
  );
}

/**
 * Pictures are drawn in the background right after a lesson is written, so a learner who opens
 * it at once can reach a screen before its picture. While any is pending, this asks the host for
 * the lesson's pictures every few seconds and hands them to the screens as they arrive.
 */
export function LessonPicturesProvider({
  children,
  getLessonPictures,
  onPicturesLost,
  steps,
}: {
  children: React.ReactNode;
  getLessonPictures: LessonPlayerAdapters["getLessonPictures"];
  /** Screens asking about a numbered picture that never came, to leave out of the lesson. */
  onPicturesLost: (stepIds: string[]) => void;
  steps: readonly PlayableLibraryStep[];
}) {
  const pendingKey = getPendingKeys(steps).join(",");
  const [state, setState] = useState<PicturesState>({ drawn: {}, settled: !pendingKey });

  useEffect(() => {
    const pending = pendingKey ? pendingKey.split(",") : [];

    if (!getLessonPictures || pending.length === 0) {
      return;
    }

    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const poll = async () => {
      const pictures = await getLessonPictures().catch(() => []);

      if (cancelled) {
        return;
      }

      const drawn = toDrawn(pictures);
      const done = pending.every((id) => drawn[id]) || Date.now() - startedAt > MAX_WAIT_MS;

      setState({ drawn, settled: done });

      if (!done) {
        timer = setTimeout(() => void poll(), POLL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [getLessonPictures, pendingKey]);

  // Without a way to ask for them, pictures drawn later only come with the next visit.
  const value = useMemo(
    () => (getLessonPictures ? state : { ...state, settled: true }),
    [getLessonPictures, state],
  );

  const lostKey = value.settled
    ? getLostNumberedScreens({ drawn: value.drawn, steps }).join(",")
    : "";

  const leaveOut = useEffectEvent((stepIds: string[]) => onPicturesLost(stepIds));

  useEffect(() => {
    if (lostKey) {
      leaveOut(lostKey.split(","));
    }
  }, [lostKey]);

  return <LessonPicturesContext value={value}>{children}</LessonPicturesContext>;
}

/**
 * A screen's picture: its own, one drawn since the lesson opened, or one still on its way. A
 * screen whose only pictures are its options' has none of its own to wait on.
 */
function useStepPicture(step: PlayableLibraryStep) {
  const { drawn, settled } = use(LessonPicturesContext);
  const own = "image" in step ? step.image : null;
  const image = own ?? drawn[step.id] ?? null;
  const asks = getImageRequest(step) !== null;
  const pending = !image && asks && "imagePending" in step && step.imagePending && !settled;

  return { image, pending };
}

/**
 * One option's picture, on a question whose options are pictures: drawn with the lesson, drawn
 * since it opened, or still on its way.
 */
export function useOptionPicture(step: PlayableLibraryStep, optionId: string) {
  const { drawn, settled } = use(LessonPicturesContext);
  const own = "optionPictures" in step ? step.optionPictures?.[optionId] : undefined;
  const image = own ?? drawn[pictureKey(step.id, optionId)] ?? null;
  const pending = !image && "imagePending" in step && step.imagePending && !settled;

  return { image, pending };
}

/**
 * Whether a screen's pictures are still being drawn, its own or its options': a question about
 * them waits, so nobody answers about a picture they can't see yet.
 */
export function useIsPictureDrawing(step: PlayableLibraryStep): boolean {
  const { drawn, settled } = use(LessonPicturesContext);
  const ownPending = useStepPicture(step).pending;
  const options = pictureOptionIds(step);

  if (options.length === 0 || settled || !("imagePending" in step) || !step.imagePending) {
    return ownPending;
  }

  const ready = step.optionPictures ?? {};
  return options.some((id) => !ready[id] && !drawn[pictureKey(step.id, id)]);
}

/**
 * Whether the labeled diagram an explanation shows to explore lost its picture: its key would
 * name numbers on nothing, so the screen teaches with its words alone.
 */
export function useIsExploredPictureLost(step: PlayableLibraryStep): boolean {
  const { image, pending } = useStepPicture(step);
  return step.kind === "explanation" && labeledDiagramOf(step) !== null && !image && !pending;
}

/** Whether a screen shows a picture, drawn or on its way, so a reading screen can lead with it. */
export function useHasStepPicture(step: PlayableLibraryStep): boolean {
  const { image, pending } = useStepPicture(step);
  return image !== null || pending;
}

/**
 * Where a picture being drawn goes: a portrait box as tall as its frame lets a picture be, so
 * nothing moves when it arrives.
 */
function LessonPicturePending({ frame }: { frame: LessonPictureFrame }) {
  const t = useExtracted();

  return (
    <div
      className={cn(
        "bg-muted/60 text-muted-foreground flex aspect-4/5 w-full flex-col items-center justify-center gap-2 rounded-2xl motion-safe:animate-pulse",
        PICTURE_FRAME_CLASS[frame],
      )}
      role="status"
    >
      <ImageIcon aria-hidden="true" className="size-6" />
      <p className="text-sm">{t("Drawing the picture…")}</p>
    </div>
  );
}

/**
 * A reading screen's picture leads it like a story: edge to edge on a phone, in the column's
 * width from a tablet up.
 */
function PictureFrame({
  children,
  frame,
}: {
  children: React.ReactNode;
  frame: LessonPictureFrame;
}) {
  return (
    <div
      className={cn(
        "flex w-full justify-center",
        frame === "hero" && "max-sm:-mx-4 max-sm:w-[calc(100%+2rem)]",
      )}
      data-slot="lesson-picture"
    >
      {children}
    </div>
  );
}

/**
 * A screen's picture, wherever it is: drawn, on its way, or (for a question about a picture whose
 * drawing failed) its description, so the question still reads. A question's picture keeps room
 * for its options; `hero` lets a reading screen's picture lead it.
 *
 * ```tsx
 * <LessonStepPicture asks priority step={step} />
 * <LessonStepPicture hero priority step={step} />
 * ```
 */
export function LessonStepPicture({
  asks = false,
  hero = false,
  priority = false,
  step,
}: {
  /** The screen's question is about the picture: without one, it shows the picture's description. */
  asks?: boolean;
  /** The picture leads a reading screen, as large as the screen allows. */
  hero?: boolean;
  priority?: boolean;
  step: PlayableLibraryStep;
}) {
  const { image, pending } = useStepPicture(step);
  const request = useMemo(() => getImageRequest(step), [step]);
  const frame = getFrame({ asks, hero });

  if (image) {
    return (
      <PictureFrame frame={frame}>
        <LessonStepImage frame={frame} image={image} priority={priority} />
      </PictureFrame>
    );
  }

  if (pending) {
    return (
      <PictureFrame frame={frame}>
        <LessonPicturePending frame={frame} />
      </PictureFrame>
    );
  }

  if (!asks || !request) {
    return null;
  }

  return (
    <figure className="bg-muted/50 text-muted-foreground flex items-start gap-3 rounded-2xl px-4 py-3 text-sm leading-relaxed">
      <ImageIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <figcaption>{request.alt}</figcaption>
    </figure>
  );
}

function getFrame({ asks, hero }: { asks: boolean; hero: boolean }): LessonPictureFrame {
  if (hero) {
    return "hero";
  }

  return asks ? "question" : "inline";
}

/**
 * The next screens' pictures, fetched while the learner reads this one, so a swipe or Next shows
 * the next picture at once. Hidden, they render at a lower priority and never compete with the
 * screen in view.
 */
export function UpcomingPictures({ steps }: { steps: readonly PlayableLibraryStep[] }) {
  const { drawn } = use(LessonPicturesContext);

  const images = steps.flatMap((step) => {
    const image = ("image" in step ? step.image : null) ?? drawn[step.id];
    const options = "optionPictures" in step ? Object.values(step.optionPictures ?? {}) : [];

    return [...(image ? [image] : []), ...options];
  });

  if (images.length === 0) {
    return null;
  }

  return (
    <Activity mode="hidden">
      {images.map((image) => (
        // Hidden and nameless: screen readers meet the picture on its own screen.
        <LessonStepImage image={{ ...image, alt: "" }} key={image.id} loading="eager" />
      ))}
    </Activity>
  );
}

/** The labeled diagram a screen asks about, or shows to explore on an explanation. */
function labeledDiagramOf(step: PlayableLibraryStep) {
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
function getImageRequest(step: PlayableLibraryStep): { alt: string } | null {
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

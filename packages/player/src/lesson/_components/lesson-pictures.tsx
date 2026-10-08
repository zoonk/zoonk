"use client";

import { type LessonPicture } from "@zoonk/core/lesson-player/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { ImageIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Activity, createContext, use, useEffect, useMemo, useState } from "react";
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
  /** Pictures drawn after the lesson opened, by screen. */
  drawn: Readonly<Record<string, PlayableStepImage>>;
  /** No more waiting: every pending picture arrived, or the wait ran out. */
  settled: boolean;
};

const LessonPicturesContext = createContext<PicturesState>({ drawn: {}, settled: true });

function getPendingIds(steps: readonly PlayableLibraryStep[]): string[] {
  return steps.flatMap((step) =>
    "imagePending" in step && step.imagePending && !step.image ? [step.id] : [],
  );
}

function toDrawn(pictures: readonly LessonPicture[]): Record<string, PlayableStepImage> {
  return Object.fromEntries(pictures.map((picture) => [picture.stepId, picture.image]));
}

/**
 * Pictures are drawn in the background right after a lesson is written, so a learner who opens
 * it at once can reach a screen before its picture. While any is pending, this asks the host for
 * the lesson's pictures every few seconds and hands them to the screens as they arrive.
 */
export function LessonPicturesProvider({
  children,
  getLessonPictures,
  steps,
}: {
  children: React.ReactNode;
  getLessonPictures: LessonPlayerAdapters["getLessonPictures"];
  steps: readonly PlayableLibraryStep[];
}) {
  const pendingKey = getPendingIds(steps).join(",");
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

  return <LessonPicturesContext value={value}>{children}</LessonPicturesContext>;
}

/** A screen's picture: its own, one drawn since the lesson opened, or one still on its way. */
function useStepPicture(step: PlayableLibraryStep) {
  const { drawn, settled } = use(LessonPicturesContext);
  const own = "image" in step ? step.image : null;
  const image = own ?? drawn[step.id] ?? null;
  const pending = !image && "imagePending" in step && step.imagePending && !settled;

  return { image, pending };
}

/**
 * Whether a screen's picture is still being drawn: a question about it waits, so nobody answers
 * about a picture they can't see yet.
 */
export function useIsPictureDrawing(step: PlayableLibraryStep): boolean {
  return useStepPicture(step).pending;
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
    return image ? [image] : [];
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

function getImageRequest(step: PlayableLibraryStep): { alt: string } | null {
  if (!("content" in step) || !("image" in step.content)) {
    return null;
  }

  const { image } = step.content;
  return image && typeof image === "object" && "alt" in image ? { alt: image.alt } : null;
}

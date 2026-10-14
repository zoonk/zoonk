"use client";

import { type LessonPicture } from "@zoonk/core/lesson-player/contract";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { ImageIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  Activity,
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { type StepPictureShown } from "../_utils/lesson-aside";
import {
  type PicturesState,
  getImageRequest,
  getLostNumberedScreens,
  getPendingKeys,
  getWaitingKeys,
  labeledDiagramOf,
  pictureKey,
  pictureOptionIds,
} from "../_utils/lesson-pictures";
import {
  type LessonPlayerAdapters,
  type PlayableLibraryStep,
  type PlayableStepImage,
} from "../lesson-player-types";
import { type LessonPictureFrame, LessonStepImage, PICTURE_FRAME_CLASS } from "./lesson-step-image";

/** How often the player asks for pictures still being drawn. */
const POLL_MS = 4000;

const LessonPicturesContext = createContext<PicturesState>({ drawn: {}, pending: [] });

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
  const startedAt = useMountTime().getTime();
  const drawnRef = useRef<Record<string, PlayableStepImage>>({});

  const [state, setState] = useState<PicturesState>(() => ({
    drawn: {},
    pending: getWaitingKeys({ drawn: {}, now: startedAt, startedAt, steps }),
  }));

  useEffect(() => {
    const pending = pendingKey ? pendingKey.split(",") : [];

    if (pending.length === 0) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const poll = async () => {
      const pictures = (await getLessonPictures?.().catch(() => [])) ?? [];

      if (cancelled) {
        return;
      }

      const drawn = { ...drawnRef.current, ...toDrawn(pictures) };
      drawnRef.current = drawn;
      const waiting = getWaitingKeys({ drawn, now: Date.now(), startedAt, steps });

      setState({ drawn, pending: waiting });

      if (waiting.length > 0) {
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
  }, [getLessonPictures, pendingKey, startedAt, steps]);

  const lostKey = getLostNumberedScreens({
    drawn: state.drawn,
    pending: state.pending,
    steps,
  }).join(",");

  const leaveOut = useEffectEvent((stepIds: string[]) => onPicturesLost(stepIds));

  useEffect(() => {
    if (lostKey) {
      leaveOut(lostKey.split(","));
    }
  }, [lostKey]);

  return <LessonPicturesContext value={state}>{children}</LessonPicturesContext>;
}

/**
 * A screen's picture: its own, one drawn since the lesson opened, or one still on its way. A
 * screen whose only pictures are its options' has none of its own to wait on.
 */
function useStepPicture(step: PlayableLibraryStep) {
  const { drawn, pending: waiting } = use(LessonPicturesContext);
  const own = "image" in step ? step.image : null;
  const image = own ?? drawn[step.id] ?? null;
  const asks = getImageRequest(step) !== null;
  const pending = !image && asks && waiting.includes(step.id);

  return { image, pending };
}

/**
 * One option's picture, on a question whose options are pictures: drawn with the lesson, drawn
 * since it opened, or still on its way.
 */
export function useOptionPicture(step: PlayableLibraryStep, optionId: string) {
  const { drawn, pending: waiting } = use(LessonPicturesContext);
  const own = "optionPictures" in step ? step.optionPictures?.[optionId] : undefined;
  const image = own ?? drawn[pictureKey(step.id, optionId)] ?? null;
  const pending = !image && waiting.includes(pictureKey(step.id, optionId));

  return { image, pending };
}

/**
 * Whether a screen's pictures are still being drawn, its own or its options': a question about
 * them waits, so nobody answers about a picture they can't see yet.
 */
export function useIsPictureDrawing(step: PlayableLibraryStep): boolean {
  const { pending } = use(LessonPicturesContext);
  const ownPending = useStepPicture(step).pending;
  const options = pictureOptionIds(step);

  if (options.length === 0) {
    return ownPending;
  }

  return ownPending || options.some((id) => pending.includes(pictureKey(step.id, id)));
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
 * What a screen's picture shows, as `LessonStepPicture` draws it: a screen that leads with its
 * picture shows it drawn or on its way, and a question about it also shows its description when
 * the drawing failed.
 */
export function useStepPictureShown(step: PlayableLibraryStep): StepPictureShown {
  const { image, pending } = useStepPicture(step);
  const shown = image !== null || pending;

  return { asked: shown || getImageRequest(step) !== null, shown };
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
        "bg-muted/60 text-muted-foreground flex aspect-4/5 w-full flex-col items-center justify-center gap-2 rounded-xl motion-safe:animate-pulse",
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
  className,
  frame,
}: {
  children: React.ReactNode;
  className?: string;
  frame: LessonPictureFrame;
}) {
  return (
    <div
      className={cn(
        "flex w-full justify-center",
        frame === "hero" && "max-sm:-mx-4 max-sm:w-[calc(100%+2rem)]",
        className,
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
  className,
  hero = false,
  priority = false,
  step,
}: {
  /** The screen's question is about the picture: without one, it shows the picture's description. */
  asks?: boolean;
  className?: string;
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
      <PictureFrame className={className} frame={frame}>
        <LessonStepImage frame={frame} image={image} priority={priority} />
      </PictureFrame>
    );
  }

  if (pending) {
    return (
      <PictureFrame className={className} frame={frame}>
        <LessonPicturePending frame={frame} />
      </PictureFrame>
    );
  }

  if (!asks || !request) {
    return null;
  }

  return (
    <figure
      className={cn(
        "bg-muted/50 text-muted-foreground flex items-start gap-3 rounded-xl px-4 py-3 text-sm leading-relaxed",
        className,
      )}
    >
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

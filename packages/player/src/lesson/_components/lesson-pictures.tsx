"use client";

import { asksNumberedPicture } from "@zoonk/core/lesson-player/picture-policy";
import { type LessonPicture } from "@zoonk/core/lesson-player/playable-lesson";
import { Skeleton } from "@zoonk/ui/components/skeleton";
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
import {
  type PicturesState,
  getImageRequest,
  getLostNumberedScreens,
  getPendingKeys,
  getWaitingKeys,
  labeledDiagramOf,
  pictureKey,
} from "../_utils/lesson-pictures";
import {
  type LessonPlayerAdapters,
  type PlayableLibraryStep,
  type PlayableStepImage,
} from "../lesson-player-types";
import { type LessonPictureFrame, LessonStepImage, PICTURE_FRAME_CLASS } from "./lesson-step-image";

const POLL_MS = 4000;

const LessonPicturesContext = createContext<PicturesState>({ drawn: {}, pending: [] });

function toDrawn(pictures: readonly LessonPicture[]): Record<string, PlayableStepImage> {
  return Object.fromEntries(
    pictures.map((picture) => [pictureKey(picture.stepId, picture.optionId), picture.image]),
  );
}

function toStepIds(keys: readonly string[]): string[] {
  return [...new Set(keys.map((key) => key.split(":")[0] ?? key))];
}

export function LessonPicturesProvider({
  children,
  getLessonPictures,
  onPicturesLost,
  steps,
}: {
  children: React.ReactNode;
  getLessonPictures: LessonPlayerAdapters["getLessonPictures"];
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
      const asked = pending.filter((key) => !drawnRef.current[key]);
      const pictures = (await getLessonPictures?.(toStepIds(asked)).catch(() => [])) ?? [];

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

function useStepPicture(step: PlayableLibraryStep) {
  const { drawn, pending: waiting } = use(LessonPicturesContext);
  const own = "image" in step ? step.image : null;
  const image = own ?? drawn[step.id] ?? null;
  const asks = getImageRequest(step) !== null;
  const pending = !image && asks && waiting.includes(step.id);

  return { image, pending };
}

export function useOptionPicture(step: PlayableLibraryStep, optionId: string) {
  const { drawn, pending: waiting } = use(LessonPicturesContext);
  const own = "optionPictures" in step ? step.optionPictures?.[optionId] : undefined;
  const image = own ?? drawn[pictureKey(step.id, optionId)] ?? null;
  const pending = !image && waiting.includes(pictureKey(step.id, optionId));

  return { image, pending };
}

export function useIsRequiredPictureDrawing(step: PlayableLibraryStep): boolean {
  const { pending } = useStepPicture(step);

  return pending && "content" in step && asksNumberedPicture(step);
}

export function useIsExploredPictureLost(step: PlayableLibraryStep): boolean {
  const { image, pending } = useStepPicture(step);
  return step.kind === "explanation" && labeledDiagramOf(step) !== null && !image && !pending;
}

export function useHasStepPicture(step: PlayableLibraryStep): boolean {
  const { image, pending } = useStepPicture(step);
  return image !== null || pending;
}

function LessonPicturePending({ alt, frame }: { alt?: string; frame: LessonPictureFrame }) {
  const t = useExtracted();

  return (
    <div
      className={cn(
        "text-muted-foreground relative flex aspect-4/5 w-full items-center justify-center overflow-hidden rounded-xl",
        PICTURE_FRAME_CLASS[frame],
      )}
    >
      <Skeleton aria-hidden="true" className="bg-muted/60 absolute inset-0" />
      <div className="relative flex flex-col items-center gap-2 p-4 text-center text-sm">
        <ImageIcon aria-hidden="true" className="size-6" />
        <p role="status">{t("Drawing the picture…")}</p>
        {alt && <p>{alt}</p>}
      </div>
    </div>
  );
}

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
        "flex w-full justify-start",
        frame === "hero" && "max-sm:-mx-4 max-sm:w-[calc(100%+2rem)]",
        className,
      )}
      data-slot="lesson-picture"
    >
      {children}
    </div>
  );
}

export function LessonStepPicture({
  asks = false,
  className,
  hero = false,
  priority = false,
  step,
}: {
  asks?: boolean;
  className?: string;
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
        <LessonPicturePending alt={asks ? request?.alt : undefined} frame={frame} />
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
        <LessonStepImage image={{ ...image, alt: "" }} key={image.id} loading="eager" />
      ))}
    </Activity>
  );
}

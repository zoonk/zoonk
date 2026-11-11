"use client";

import { useMindMapAlt } from "@zoonk/learn/mind-maps/description";
import { MindMapOutline } from "@zoonk/learn/mind-maps/outline";
import { type MindMapSave } from "@zoonk/learn/mind-maps/save";
import { toMindMapSrc } from "@zoonk/learn/mind-maps/urls";
import { MindMapViewer } from "@zoonk/learn/mind-maps/viewer";
import { TASK_COLUMN_CLASS } from "@zoonk/learn/task-layout";
import { Button } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { Maximize2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { SCREEN_TURN_CLASS, type ScreenTurn } from "../components/screen-turn";
import { LessonMap } from "../lesson/_components/lesson-map";
import { SWIPE_THROUGH } from "../lesson/use-swipe-navigation";
import { type ChapterSlide, type LessonMindMap } from "./mind-map-deck";

const THUMBNAIL_WIDTH = 640;
const COLUMN_CLASS = cn(TASK_COLUMN_CLASS, "flex flex-col gap-5 pt-4 pb-8");
const NOTE_CLASS = "text-muted-foreground text-sm text-pretty";

/** One map of the deck, arriving from the side it was turned from, at the top of the screen. */
export function SlideFrame({
  children,
  turn,
}: {
  children: React.ReactNode;
  turn: ScreenTurn | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    ref.current?.parentElement?.scrollTo({ top: 0 });
  }, []);

  return (
    <div
      className={cn("flex w-full flex-col", turn && SCREEN_TURN_CLASS[turn])}
      data-slot="mind-map-slide"
      data-turn={turn ?? undefined}
      ref={ref}
    >
      {children}
    </div>
  );
}

/**
 * The picture, then its outline under it. From 72rem they sit side by side, the picture held in
 * view at the height the window leaves it while the outline scrolls.
 */
export function ChapterMapSlide({ save, slide }: { save: MindMapSave; slide: ChapterSlide }) {
  const t = useExtracted();
  const [isZoomed, setIsZoomed] = useState(false);
  const { image, outline, title } = slide;
  const alt = useMindMapAlt({ outline, title });

  if (!image) {
    return (
      <div className={COLUMN_CLASS} data-slot="chapter-map-slide">
        <p className={NOTE_CLASS}>
          {t("Its picture had mistakes, so here's the mind map as text.")}
        </p>
        <MindMapOutline outline={outline} />
      </div>
    );
  }

  return (
    <div
      className="max-w-column mx-auto grid w-full gap-6 px-4 pt-4 pb-8 min-[72rem]:max-w-304 min-[72rem]:grid-cols-[minmax(0,1fr)_22rem] min-[72rem]:items-start min-[72rem]:gap-10 min-[72rem]:px-6"
      data-slot="chapter-map-slide"
    >
      <div className="flex w-full flex-col items-start gap-1.5 justify-self-center min-[72rem]:sticky min-[72rem]:top-4 min-[72rem]:max-w-[calc(100dvh-13rem)]">
        <button
          className="focus-visible:ring-ring/50 w-full rounded-xl outline-none focus-visible:ring-[3px]"
          onClick={() => setIsZoomed(true)}
          type="button"
          {...SWIPE_THROUGH}
        >
          {/* oxlint-disable-next-line next/no-img-element -- @zoonk/player doesn't depend on next/image; maps are stored, optimized webp files. */}
          <img
            alt={alt}
            className="ring-border bg-card aspect-square h-auto w-full rounded-xl object-contain ring-1"
            decoding="async"
            height={image.height}
            sizes="(min-width: 72rem) 50rem, 100vw"
            src={toMindMapSrc(image.url)}
            srcSet={`${toMindMapSrc(image.thumbnailUrl)} ${THUMBNAIL_WIDTH}w, ${toMindMapSrc(image.url)} ${image.width}w`}
            width={image.width}
          />
        </button>

        <Button className="-ml-2" onClick={() => setIsZoomed(true)} size="sm" variant="ghost">
          <Maximize2Icon aria-hidden="true" data-icon="inline-start" />
          {t("Full screen")}
        </Button>
      </div>

      <MindMapOutline outline={outline} />

      <MindMapViewer
        image={image}
        onOpenChange={setIsZoomed}
        open={isZoomed}
        outline={outline}
        save={save}
        title={title}
      />
    </div>
  );
}

function LessonMapSkeleton() {
  return (
    <div aria-busy="true" className="flex w-full flex-col items-center gap-5">
      <Skeleton className="h-9 w-48 rounded-[9px]" />
      <div className="grid w-full grid-cols-1 gap-x-3 gap-y-5 min-[26rem]:grid-cols-2">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl min-[26rem]:col-span-2 min-[26rem]:w-1/2 min-[26rem]:justify-self-center" />
      </div>
    </div>
  );
}

/** `lessons` is the slide's chapter's lesson maps: undefined while they load, `failed` when they didn't. */
export function LessonMapSlide({
  lesson,
  lessons,
  onRetry,
}: {
  lesson: LessonMindMap | null;
  lessons: readonly LessonMindMap[] | "failed" | undefined;
  onRetry: () => void;
}) {
  const t = useExtracted();

  if (lessons === undefined) {
    return (
      <div className={COLUMN_CLASS} data-slot="lesson-map-slide">
        <LessonMapSkeleton />
      </div>
    );
  }

  if (lessons === "failed") {
    return (
      <div className={cn(COLUMN_CLASS, "items-start")} data-slot="lesson-map-slide">
        <p className={NOTE_CLASS} role="status">
          {t("We couldn't reach the server. Check your connection.")}
        </p>
        <Button onClick={onRetry} size="sm" variant="outline">
          {t("Try again")}
        </Button>
      </div>
    );
  }

  if (!lesson?.map) {
    return (
      <div className={COLUMN_CLASS} data-slot="lesson-map-slide">
        <p className={NOTE_CLASS}>{t("This map is no longer available.")}</p>
      </div>
    );
  }

  return (
    <div className={COLUMN_CLASS} data-slot="lesson-map-slide">
      <LessonMap map={lesson.map} title={lesson.title} />
    </div>
  );
}

"use client";

import { MindMapDescription } from "@zoonk/learn/mind-maps/description";
import { MindMapOutline } from "@zoonk/learn/mind-maps/outline";
import { type MindMapSave } from "@zoonk/learn/mind-maps/save";
import { MindMapThumbnail } from "@zoonk/learn/mind-maps/thumbnail";
import { MindMapViewer } from "@zoonk/learn/mind-maps/viewer";
import { TASK_COLUMN_CLASS } from "@zoonk/learn/task-layout";
import { Button } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { SCREEN_TURN_CLASS, type ScreenTurn } from "../components/screen-turn";
import { LessonMap } from "../lesson/_components/lesson-map";
import { SWIPE_THROUGH } from "../lesson/use-swipe-navigation";
import { type ChapterSlide, type LessonMindMap } from "./mind-map-deck";

const COLUMN_CLASS = cn(TASK_COLUMN_CLASS, "flex flex-col gap-5 pt-4 pb-8");
const NOTE_CLASS = "text-muted-foreground text-sm";

/**
 * The map as big as the window lets it be while the whole map stays in view under the header, the
 * switch and the bar, so a window that's wide but short doesn't push its bottom out of sight.
 */
const MAP_FRAME_CLASS =
  "mx-auto w-full max-w-[max(20rem,min(64rem,calc(100dvh-12.5rem)))] px-[16px]";

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

export type ChapterMapView = "map" | "text";

/**
 * The map's picture or its text, one at a time: the picture at its full width, so its writing reads
 * without zooming, or the text as a single reading column. Either way a screen reader gets the
 * text once, as the picture's description or as the text itself.
 */
export function ChapterMapSlide({
  onViewChange,
  save,
  slide,
  view,
}: {
  onViewChange: (view: ChapterMapView) => void;
  save: MindMapSave;
  slide: ChapterSlide;
  view: ChapterMapView;
}) {
  const t = useExtracted();
  const descriptionId = useId();
  const [isZoomed, setIsZoomed] = useState(false);
  const { image, outline, title } = slide;

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
    <Tabs
      className="w-full gap-2 pb-8"
      data-slot="chapter-map-slide"
      onValueChange={(value: ChapterMapView) => onViewChange(value)}
      value={view}
    >
      <div className="bg-background sticky top-0 z-10 flex justify-center py-2">
        <TabsList aria-label={t("Show the map as")}>
          <TabsTrigger value="map">{t("Map")}</TabsTrigger>
          <TabsTrigger value="text">{t("Text")}</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent className={MAP_FRAME_CLASS} value="map">
        <button
          aria-describedby={descriptionId}
          aria-haspopup="dialog"
          className="focus-visible:ring-ring/50 w-full cursor-zoom-in rounded-xl outline-none focus-visible:ring-[3px]"
          onClick={() => setIsZoomed(true)}
          type="button"
          {...SWIPE_THROUGH}
        >
          <MindMapThumbnail
            className="outline-border bg-card aspect-square h-auto w-full rounded-xl object-contain outline -outline-offset-1"
            image={image}
            outline={outline}
            sizes="(min-width: 72rem) 64rem, 100vw"
            title={title}
          />
        </button>
        <p
          aria-hidden="true"
          className="text-muted-foreground mt-3 hidden text-center text-sm pointer-coarse:block"
        >
          {t("Tap the map to zoom in")}
        </p>
        <MindMapDescription id={descriptionId} outline={outline} />
      </TabsContent>

      <TabsContent className={TASK_COLUMN_CLASS} value="text">
        <MindMapOutline outline={outline} titled />
      </TabsContent>

      <MindMapViewer
        image={image}
        onOpenChange={setIsZoomed}
        open={isZoomed}
        outline={outline}
        save={save}
        title={title}
      />
    </Tabs>
  );
}

function LessonMapSkeleton() {
  return (
    <div aria-busy="true" className="flex w-full flex-col items-center gap-5">
      <Skeleton className="h-9 w-48 rounded-lg" />
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
        <p className={NOTE_CLASS}>{t("This map isn't available anymore.")}</p>
      </div>
    );
  }

  return (
    <div className={COLUMN_CLASS} data-slot="lesson-map-slide">
      <LessonMap map={lesson.map} title={lesson.title} />
    </div>
  );
}

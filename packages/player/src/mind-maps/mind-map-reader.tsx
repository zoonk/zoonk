"use client";

import { type SaveMindMap } from "@zoonk/learn/mind-maps/actions";
import { keepMindMapPlace } from "@zoonk/learn/mind-maps/resume";
import { type MindMapSave, MindMapSaveButton } from "@zoonk/learn/mind-maps/save";
import { type SavedMapTarget, toSavedMapKey, useMindMapSaves } from "@zoonk/learn/mind-maps/saves";
import { type MindMapTab, buildStudyHref } from "@zoonk/learn/mind-maps/urls";
import { TaskFrame, TaskMainButton, TaskMainLink } from "@zoonk/learn/task-frame";
import { TaskHeaderTitle } from "@zoonk/learn/task-header";
import { TaskActions } from "@zoonk/learn/task-layout";
import { Button, FORWARD_ICON } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useKeyboardCallback, useLetterKey } from "@zoonk/ui/hooks/keyboard";
import { CheckIcon, ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { type ScreenTurn } from "../components/screen-turn";
import { useSwipeNavigation } from "../lesson/use-swipe-navigation";
import { type DeckSlide, type LessonMindMap, findLessonMap } from "./mind-map-deck";
import { type MindMapReaderHrefs, MindMapReaderMenu } from "./mind-map-reader-menu";
import { ChapterMapSlide, LessonMapSlide, SlideFrame } from "./mind-map-slides";
import { type ChapterLessons, type LoadLessonMaps, useChapterLessons } from "./use-chapter-lessons";

const SCREEN_KEY = { mode: "none", screen: true } as const;

const SAVE_KEY = "s";

export type MindMapReaderActions = { lessonMaps: LoadLessonMaps; save: SaveMindMap };

/**
 * Keeps where the learner is: in the address for a reload, and for the next time they study. On
 * the last map the deck is finished, so the next time starts from the first.
 */
function useKeptPlace({
  chapterId,
  goalId,
  isLast,
  lessonId,
  view,
}: {
  chapterId: string;
  goalId: string;
  isLast: boolean;
  lessonId: string | null;
  view: MindMapTab;
}) {
  useEffect(() => {
    const place = { chapterId, lessonId };
    const address = new URL(globalThis.location.href);
    address.search = buildStudyHref({ place, study: "", view });

    keepMindMapPlace({ goalId, view }, isLast ? null : place);
    globalThis.history.replaceState(null, "", address);
  }, [chapterId, goalId, isLast, lessonId, view]);
}

function useSlideTitle({ lesson, slide }: { lesson: LessonMindMap | null; slide: DeckSlide }) {
  const t = useExtracted();

  if (slide.kind === "chapter") {
    return {
      detail: t("Chapter {number, number}", { number: slide.position }),
      title: slide.title,
    };
  }

  const chapter = t("Chapter {number, number}", { number: slide.chapterPosition });

  return lesson
    ? {
        detail: `${chapter} · ${t("Lesson {number, number}", { number: lesson.position })}`,
        title: lesson.title,
      }
    : { detail: chapter, title: slide.chapterTitle };
}

function EmptyDeck({ exit }: { exit: string }) {
  const t = useExtracted();

  return (
    <TaskFrame
      closeOnEscape
      exitHref={exit}
      exitToApp
      footer={
        <TaskActions>
          <TaskMainLink href={exit} icon={<CheckIcon aria-hidden="true" />} toApp>
            {t("Done")}
          </TaskMainLink>
        </TaskActions>
      }
      headerTitle={<TaskHeaderTitle title={t("Mind maps")} />}
    >
      <p className="text-muted-foreground text-sm text-pretty" data-slot="mind-map-reader-empty">
        {t("There are no maps to study here yet.")}
      </p>
    </TaskFrame>
  );
}

type ReaderPlace = { index: number; turn: ScreenTurn | null };

function Reader({
  actions,
  deck,
  goalId,
  hrefs,
  lessons: loaded,
  slide,
  start,
  view,
}: MindMapReaderProps & { slide: DeckSlide }) {
  const t = useExtracted();
  const body = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<ReaderPlace>({ index: start, turn: null });
  const [stored, setStored] = useState<ReadonlyMap<string, boolean>>(new Map());
  const chapters = useChapterLessons({ deck, index: at.index, load: actions.lessonMaps, loaded });

  const saves = useMindMapSaves({
    onSaved: (target, saved) =>
      setStored((current) => new Map(current).set(toSavedMapKey(target), saved)),
    save: actions.save,
  });

  const shown = deck[at.index] ?? slide;
  const chapterLessons = shown.kind === "lesson" ? chapters.lessons[shown.chapterId] : undefined;

  const lesson =
    shown.kind === "lesson" && Array.isArray(chapterLessons)
      ? findLessonMap({ lessons: chapterLessons, slide: shown })
      : null;

  const lessonId = shown.kind === "lesson" ? (lesson?.lessonId ?? shown.lessonId) : null;
  const isFirst = at.index === 0;
  const isLast = at.index === deck.length - 1;
  const heading = useSlideTitle({ lesson, slide: shown });

  const target: SavedMapTarget | null =
    shown.kind === "chapter"
      ? { kind: "chapter", targetId: shown.chapterId }
      : lesson && { kind: "lesson", targetId: lesson.lessonId };

  const servedSaved = shown.kind === "chapter" ? shown.saved : (lesson?.saved ?? false);

  const savedState = target && { saved: stored.get(toSavedMapKey(target)) ?? servedSaved, target };

  const save: MindMapSave | null = savedState && {
    onToggle: () => saves.toggle(savedState),
    saved: saves.isSaved(savedState),
  };

  const turnTo = (index: number, turn: ScreenTurn) => {
    if (index < 0 || index >= deck.length || index === at.index) {
      return false;
    }

    setAt({ index, turn });
    return true;
  };

  const next = () => turnTo(at.index + 1, "forward");
  const previous = () => turnTo(at.index - 1, "back");

  useKeptPlace({ chapterId: shown.chapterId, goalId, isLast, lessonId, view });
  useSwipeNavigation({ onBack: previous, onForward: next, ref: body });
  useKeyboardCallback("ArrowRight", () => next() && undefined, SCREEN_KEY);
  useKeyboardCallback("ArrowLeft", () => previous() && undefined, SCREEN_KEY);
  useLetterKey(SAVE_KEY, () => (save ? save.onToggle() : false));

  return (
    <TaskFrame
      closeOnEscape
      exitHref={hrefs.exit}
      exitToApp
      fit="always"
      footer={
        <TaskActions data-slot="mind-map-reader-actions">
          <div className="flex items-center gap-2.5 lg:mr-auto">
            <Button
              aria-keyshortcuts="ArrowLeft"
              className="size-11 shrink-0"
              disabled={isFirst}
              onClick={previous}
              size="icon"
              variant="outline"
            >
              <ChevronLeftIcon aria-hidden="true" />
              <span className="sr-only">{t("Previous map")}</span>
            </Button>

            <p className="text-muted-foreground font-mono text-xs whitespace-nowrap tabular-nums">
              {t("{current, number} of {total, number}", {
                current: at.index + 1,
                total: deck.length,
              })}
            </p>
          </div>

          {save && (
            <MindMapSaveButton aria-keyshortcuts={SAVE_KEY} {...save}>
              <ShortcutKbd>{SAVE_KEY.toUpperCase()}</ShortcutKbd>
            </MindMapSaveButton>
          )}

          {isLast ? (
            <TaskMainLink href={hrefs.exit} icon={<CheckIcon aria-hidden="true" />} toApp>
              {t("Done")}
            </TaskMainLink>
          ) : (
            <TaskMainButton {...FORWARD_ICON} onClick={next}>
              {t("Next")}
            </TaskMainButton>
          )}
        </TaskActions>
      }
      headerEnd={
        <MindMapReaderMenu
          chapterId={shown.chapterId}
          hrefs={hrefs}
          isFirst={isFirst}
          lessonId={lessonId}
          onRestart={() => turnTo(0, "back")}
        />
      }
      headerTitle={<TaskHeaderTitle detail={heading.detail} title={heading.title} />}
    >
      <div
        className="min-h-0 flex-1 overflow-x-clip overflow-y-auto"
        data-slot="mind-map-reader"
        ref={body}
      >
        <SlideFrame key={`${at.index}`} turn={at.turn}>
          {shown.kind === "chapter" && save ? (
            <ChapterMapSlide save={save} slide={shown} />
          ) : (
            <LessonMapSlide
              lesson={lesson}
              lessons={chapterLessons}
              onRetry={() => chapters.retry(shown.chapterId)}
            />
          )}
        </SlideFrame>
      </div>
    </TaskFrame>
  );
}

type MindMapReaderProps = {
  actions: MindMapReaderActions;
  /** Frozen when the deck opens: what the server sends later doesn't reorder it under the learner. */
  deck: readonly DeckSlide[];
  goalId: string;
  hrefs: MindMapReaderHrefs;
  /** The lesson maps the server already read, by chapter: those of the map the deck opens on. */
  lessons: ChapterLessons;
  start: number;
  view: MindMapTab;
};

export function MindMapReader(props: MindMapReaderProps) {
  // oxlint-disable-next-line react/hook-use-state -- Read once when the deck opens, so there is no setter.
  const [{ deck, start }] = useState({ deck: props.deck, start: props.start });
  const slide = deck[start] ?? deck[0];

  return slide ? (
    <Reader {...props} deck={deck} slide={slide} start={deck[start] ? start : 0} />
  ) : (
    <EmptyDeck exit={props.hrefs.exit} />
  );
}

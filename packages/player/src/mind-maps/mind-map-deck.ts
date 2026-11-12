import {
  type GoalMindMapView,
  type GoalMindMapsView,
  type MindMapImage,
  type MindMapOutline,
} from "@zoonk/core/mind-maps/contract";
import { type ChapterLessonMapsView } from "@zoonk/core/mind-maps/lesson-maps-contract";
import { type MindMapPlace, type MindMapTab } from "@zoonk/learn/mind-maps/urls";

export type LessonMindMap = ChapterLessonMapsView["lessons"][number];

export type ChapterSlide = {
  chapterId: string;
  image: MindMapImage | null;
  kind: "chapter";
  outline: MindMapOutline;
  title: string;
};

/** A lesson map is read with its chapter's others, so the deck names it without holding it. */
export type LessonSlide = {
  chapterId: string;
  chapterTitle: string;
  kind: "lesson";
  lessonId: string;
};

export type DeckSlide = ChapterSlide | LessonSlide;

function toChapterSlide(chapter: GoalMindMapView): ChapterSlide[] {
  if (chapter.status !== "ready" || !chapter.outline) {
    return [];
  }

  return [
    {
      chapterId: chapter.chapterId,
      image: chapter.image,
      kind: "chapter",
      outline: chapter.outline,
      title: chapter.title,
    },
  ];
}

function toLessonSlide({
  chapter,
  lessonId,
}: {
  chapter: GoalMindMapView;
  lessonId: string;
}): LessonSlide {
  return { chapterId: chapter.chapterId, chapterTitle: chapter.title, kind: "lesson", lessonId };
}

function buildLessonsDeck(mindMaps: GoalMindMapsView): DeckSlide[] {
  return mindMaps.lessonGroups.flatMap((group) => {
    const chapter = mindMaps.chapters.find((candidate) => candidate.chapterId === group.chapterId);

    return chapter ? group.lessonIds.map((lessonId) => toLessonSlide({ chapter, lessonId })) : [];
  });
}

function buildSavedDeck(mindMaps: GoalMindMapsView): DeckSlide[] {
  return mindMaps.saved.flatMap((saved): DeckSlide[] => {
    const chapter = mindMaps.chapters.find((candidate) => candidate.chapterId === saved.chapterId);

    if (!saved.available || !chapter) {
      return [];
    }

    return saved.kind === "chapter"
      ? toChapterSlide(chapter)
      : [toLessonSlide({ chapter, lessonId: saved.targetId })];
  });
}

/**
 * The maps a tab studies, in the order the list gives them (the syllabus's). Maps Plus keeps and
 * saves that can no longer open are left out.
 */
export function buildMindMapDeck({
  mindMaps,
  view,
}: {
  mindMaps: GoalMindMapsView;
  view: MindMapTab;
}): DeckSlide[] {
  if (view === "lessons") {
    return buildLessonsDeck(mindMaps);
  }

  return view === "saved"
    ? buildSavedDeck(mindMaps)
    : mindMaps.chapters.flatMap((chapter) => toChapterSlide(chapter));
}

/** Null when the chapter no longer has that map, such as a lesson rewritten since the deck opened. */
export function findLessonMap({
  lessons,
  slide,
}: {
  lessons: readonly LessonMindMap[];
  slide: LessonSlide;
}): LessonMindMap | null {
  return (
    lessons.find(
      (lesson) => lesson.lessonId === slide.lessonId && !lesson.locked && lesson.map !== null,
    ) ?? null
  );
}

function isAt({ place, slide }: { place: MindMapPlace; slide: DeckSlide }): boolean {
  return (
    slide.chapterId === place.chapterId &&
    (slide.kind === "chapter" ? null : slide.lessonId) === (place.lessonId ?? null)
  );
}

/** Where a deck opens: the map the place names, else the first of its chapter, else the first map. */
export function findDeckStart({
  deck,
  place,
}: {
  deck: readonly DeckSlide[];
  place: MindMapPlace | null;
}): number {
  if (!place) {
    return 0;
  }

  const exact = deck.findIndex((slide) => isAt({ place, slide }));
  const chapter = deck.findIndex((slide) => slide.chapterId === place.chapterId);

  return Math.max(0, exact === -1 ? chapter : exact);
}

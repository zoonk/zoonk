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
  position: number;
  saved: boolean;
  title: string;
};

/**
 * A lesson map is read with its chapter's others, so the deck names it without holding it: by
 * `lessonId` when it knows which lesson (a saved map), otherwise by `slot`, its place among the
 * chapter's maps that open.
 */
export type LessonSlide = {
  chapterId: string;
  chapterPosition: number;
  chapterTitle: string;
  kind: "lesson";
  lessonId: string | null;
  slot: number;
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
      position: chapter.position,
      saved: chapter.saved,
      title: chapter.title,
    },
  ];
}

function toLessonSlide({
  chapter,
  lessonId,
  slot,
}: {
  chapter: GoalMindMapView;
  lessonId: string | null;
  slot: number;
}): LessonSlide {
  return {
    chapterId: chapter.chapterId,
    chapterPosition: chapter.position,
    chapterTitle: chapter.title,
    kind: "lesson",
    lessonId,
    slot,
  };
}

function buildLessonsDeck(mindMaps: GoalMindMapsView): DeckSlide[] {
  return mindMaps.lessonGroups.flatMap((group) => {
    const chapter = mindMaps.chapters.find((candidate) => candidate.chapterId === group.chapterId);

    return chapter
      ? Array.from({ length: group.count - group.locked }, (_, slot) =>
          toLessonSlide({ chapter, lessonId: null, slot }),
        )
      : [];
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
      : [toLessonSlide({ chapter, lessonId: saved.targetId, slot: 0 })];
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

/** The chapter's lesson maps that open, which a lesson slide's `slot` counts through. */
function getOpenLessonMaps(lessons: readonly LessonMindMap[]): LessonMindMap[] {
  return lessons.filter((lesson) => !lesson.locked && lesson.map !== null);
}

/** Null when the chapter no longer has that map, such as a lesson rewritten since the deck opened. */
export function findLessonMap({
  lessons,
  slide,
}: {
  lessons: readonly LessonMindMap[];
  slide: LessonSlide;
}): LessonMindMap | null {
  const open = getOpenLessonMaps(lessons);

  return slide.lessonId
    ? (open.find((lesson) => lesson.lessonId === slide.lessonId) ?? null)
    : (open[slide.slot] ?? null);
}

function isAt({
  lessons,
  place,
  slide,
}: {
  lessons: readonly LessonMindMap[];
  place: MindMapPlace;
  slide: DeckSlide;
}): boolean {
  if (slide.chapterId !== place.chapterId) {
    return false;
  }

  if (slide.kind === "chapter") {
    return !place.lessonId;
  }

  const lessonId = slide.lessonId ?? findLessonMap({ lessons, slide })?.lessonId;
  return (lessonId ?? null) === (place.lessonId ?? null);
}

/**
 * Where a deck opens: the map the place names, else the first of its chapter, else the first map.
 * `lessons` are the place's chapter's lesson maps, when the place names one of them.
 */
export function findDeckStart({
  deck,
  lessons = [],
  place,
}: {
  deck: readonly DeckSlide[];
  lessons?: readonly LessonMindMap[];
  place: MindMapPlace | null;
}): number {
  if (!place) {
    return 0;
  }

  const exact = deck.findIndex((slide) => isAt({ lessons, place, slide }));
  const chapter = deck.findIndex((slide) => slide.chapterId === place.chapterId);

  return Math.max(0, exact === -1 ? chapter : exact);
}

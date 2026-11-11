import { type GoalMindMapView, type GoalMindMapsView } from "@zoonk/core/mind-maps/contract";
import { describe, expect, it } from "vitest";
import {
  type LessonMindMap,
  buildMindMapDeck,
  findDeckStart,
  findLessonMap,
} from "./mind-map-deck";

const OUTLINE = { branches: [], centralIdea: "Idea", comparison: null, summary: "Sum", title: "T" };

function chapter(id: string, overrides: Partial<GoalMindMapView> = {}): GoalMindMapView {
  return {
    chapterId: id,
    image: null,
    lessonsToWrite: 0,
    outline: OUTLINE,
    position: 1,
    saved: false,
    status: "ready",
    subject: null,
    title: `Chapter ${id}`,
    ...overrides,
  };
}

function lesson(id: string, overrides: Partial<LessonMindMap> = {}): LessonMindMap {
  return {
    lessonId: id,
    locked: false,
    map: { ideas: [{ text: "An idea." }], shape: "hub" },
    position: 1,
    saved: false,
    title: `Lesson ${id}`,
    ...overrides,
  };
}

function mindMaps(overrides: Partial<GoalMindMapsView>): GoalMindMapsView {
  return {
    chapters: [],
    createOffer: { eligible: 0, needLessons: 0, startable: 0, stop: null },
    firstTab: "chapters",
    goal: { displayName: "Goal", id: "goal", title: "Goal" },
    lessonGroups: [],
    saved: [],
    ...overrides,
  };
}

describe(buildMindMapDeck, () => {
  it("the chapters deck holds only maps that open, in list order", () => {
    const deck = buildMindMapDeck({
      mindMaps: mindMaps({
        chapters: [
          chapter("a"),
          chapter("b", { outline: null, status: "drawing" }),
          chapter("c", { outline: null, status: "plusRequired" }),
          chapter("d"),
        ],
      }),
      view: "chapters",
    });

    expect(deck.map((slide) => slide.chapterId)).toStrictEqual(["a", "d"]);
  });

  it("the lessons deck has one slide for each lesson map that opens, chapter by chapter", () => {
    const deck = buildMindMapDeck({
      mindMaps: mindMaps({
        chapters: [chapter("a"), chapter("b")],
        lessonGroups: [
          { chapterId: "a", count: 3, locked: 1 },
          { chapterId: "b", count: 1, locked: 0 },
        ],
      }),
      view: "lessons",
    });

    expect(
      deck.map((slide) => [slide.chapterId, slide.kind === "lesson" && slide.slot]),
    ).toStrictEqual([
      ["a", 0],
      ["a", 1],
      ["b", 0],
    ]);
  });

  it("the saved deck leaves out saves that can no longer open", () => {
    const deck = buildMindMapDeck({
      mindMaps: mindMaps({
        chapters: [chapter("a")],
        saved: [
          { available: true, chapterId: "a", kind: "chapter", targetId: "a", title: "A" },
          { available: true, chapterId: "a", kind: "lesson", targetId: "l1", title: "L1" },
          { available: false, chapterId: null, kind: "lesson", targetId: "l2", title: "L2" },
        ],
      }),
      view: "saved",
    });

    expect(
      deck.map((slide) => (slide.kind === "lesson" ? slide.lessonId : slide.kind)),
    ).toStrictEqual(["chapter", "l1"]);
  });
});

describe(findLessonMap, () => {
  const slide = buildMindMapDeck({
    mindMaps: mindMaps({
      chapters: [chapter("a")],
      lessonGroups: [{ chapterId: "a", count: 3, locked: 1 }],
    }),
    view: "lessons",
  })[1];

  it("a slot counts only the maps that open", () => {
    const lessons = [lesson("l1"), lesson("l2", { locked: true, map: null }), lesson("l3")];

    expect(slide?.kind === "lesson" && findLessonMap({ lessons, slide })?.lessonId).toBe("l3");
  });

  it("a slot the chapter no longer fills finds nothing", () => {
    expect(
      slide?.kind === "lesson" && findLessonMap({ lessons: [lesson("l1")], slide }),
    ).toBeNull();
  });
});

describe(findDeckStart, () => {
  const deck = buildMindMapDeck({
    mindMaps: mindMaps({
      chapters: [chapter("a"), chapter("b")],
      lessonGroups: [
        { chapterId: "a", count: 2, locked: 0 },
        { chapterId: "b", count: 2, locked: 0 },
      ],
    }),
    view: "lessons",
  });

  it("opens on the lesson the place names", () => {
    const lessons = [lesson("l1"), lesson("l2")];
    const place = { chapterId: "b", lessonId: "l2" };

    expect(findDeckStart({ deck, lessons, place })).toBe(3);
  });

  it("opens on the chapter's first map when the lesson isn't among its maps", () => {
    expect(findDeckStart({ deck, place: { chapterId: "b", lessonId: "gone" } })).toBe(2);
  });

  it("opens on the first map without a place, or with one the deck doesn't hold", () => {
    expect(findDeckStart({ deck, place: null })).toBe(0);
    expect(findDeckStart({ deck, place: { chapterId: "z" } })).toBe(0);
  });
});

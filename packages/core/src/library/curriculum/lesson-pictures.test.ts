import { type LessonScreen, type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { describe, expect, it } from "vitest";
import { temperatureSpec } from "../quality/_test-utils/written-lessons";
import { dropDecorativePictures, listPlannedPictures } from "./lesson-pictures";

function pictured(kind: LessonScreen["kind"]): LessonScreen {
  return {
    activityTemplate: null,
    brief: kind,
    kind,
    skills: kind === "hook" ? [] : [0],
    visual: `A ${kind}`,
    visualKind: "picture",
  };
}

function plain(kind: LessonScreen["kind"]): LessonScreen {
  return { ...pictured(kind), visual: null, visualKind: "none" };
}

function lessonOf(screens: LessonScreen[]): LessonSpec {
  return { ...temperatureSpec(), screens };
}

const screens = [
  pictured("hook"),
  pictured("explanation"),
  plain("guess"),
  pictured("explanation"),
  pictured("check"),
  pictured("explanation"),
  plain("check"),
  plain("application"),
];

function kindsAfterDropping(dropped: number[], planned: LessonScreen[] = screens) {
  const [spec] = dropDecorativePictures({
    judged: dropped.map((screen) => ({ lesson: 0, screen, teaches: false })),
    specs: [lessonOf(planned)],
  });

  return spec?.screens.map((screen) => [screen.visualKind, screen.visual]);
}

describe(dropDecorativePictures, () => {
  it("leaves a screen whose picture only decorates with nothing, never a table in its place", () => {
    const kinds = kindsAfterDropping([0, 1, 4]);

    expect(kinds?.[0]).toStrictEqual(["none", null]);
    expect(kinds?.[1]).toStrictEqual(["none", null]);
    expect(kinds?.[3]).toStrictEqual(["picture", "A explanation"]);
    expect(kinds?.[4]).toStrictEqual(["none", null]);
  });

  it("judges a picture shown on several screens once, and drops it from all of them", () => {
    const heart = { ...pictured("explanation"), visual: "The heart from the front" };
    const shared = [pictured("hook"), heart, heart, heart, plain("check"), ...screens.slice(5)];

    expect(
      listPlannedPictures({ specs: [lessonOf(shared)] }).map((item) => item.screen),
    ).toStrictEqual([0, 1, 5]);

    expect(kindsAfterDropping([1], shared)?.slice(1, 4)).toStrictEqual([
      ["none", null],
      ["none", null],
      ["none", null],
    ]);
  });

  it("judges a picture the scene shares with the next screen on that screen, where it teaches", () => {
    const cell = { ...pictured("explanation"), visual: "A cell and its parts" };
    const shared = [{ ...pictured("hook"), visual: cell.visual }, cell, ...screens.slice(2)];

    expect(
      listPlannedPictures({ specs: [lessonOf(shared)] })
        .slice(0, 1)
        .map((item) => [item.screen, item.kind, item.brief]),
    ).toStrictEqual([[0, "explanation", "explanation"]]);
  });

  it("judges every planned picture, the scene's and a question's included", () => {
    expect(
      listPlannedPictures({ specs: [lessonOf(screens)] }).map((item) => [item.screen, item.kind]),
    ).toStrictEqual([
      [0, "hook"],
      [1, "explanation"],
      [3, "explanation"],
      [4, "check"],
      [5, "explanation"],
    ]);
  });
});

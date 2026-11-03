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
  plain("check"),
  pictured("explanation"),
  plain("check"),
  plain("application"),
];

function kindsAfterDropping(
  dropped: number[],
  visualFloor: "drawn" | "none" | "pictures",
  planned: LessonScreen[] = screens,
) {
  const [spec] = dropDecorativePictures({
    judged: dropped.map((screen) => ({ lesson: 0, screen, teaches: false })),
    specs: [lessonOf(planned)],
    visualFloor,
  });

  return spec?.screens.map((screen) => [screen.visualKind, screen.visual]);
}

describe(dropDecorativePictures, () => {
  it("drops a decorative picture the lesson can spare", () => {
    expect(kindsAfterDropping([3], "pictures")?.[3]).toStrictEqual(["none", null]);
  });

  it("draws a table instead when the floor needs that screen", () => {
    const kinds = kindsAfterDropping([1, 3], "pictures");

    expect(kinds?.[1]).toStrictEqual(["table", null]);
    expect(kinds?.[3]).toStrictEqual(["none", null]);
  });

  it("judges a picture shown on several screens once, and drops it from all of them", () => {
    const heart = { ...pictured("explanation"), visual: "The heart from the front" };
    const shared = [pictured("hook"), heart, heart, heart, plain("check"), ...screens.slice(5)];

    expect(
      listPlannedPictures({ specs: [lessonOf(shared)] }).map((item) => item.screen),
    ).toStrictEqual([1, 5]);

    const kinds = kindsAfterDropping([1], "none", shared);

    expect(kinds?.slice(1, 4)).toStrictEqual([
      ["none", null],
      ["none", null],
      ["none", null],
    ]);
  });

  it("never judges the scene's picture, so every lesson opens on its moment", () => {
    expect(
      listPlannedPictures({ specs: [lessonOf(screens)] }).map((item) => item.screen),
    ).toStrictEqual([1, 3, 5]);
  });
});

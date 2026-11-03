import { type LessonScreen, type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { describe, expect, it } from "vitest";
import { temperatureSpec } from "../quality/_test-utils/written-lessons";
import { dropDecorativePictures } from "./lesson-pictures";

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
  plain("explanation"),
  plain("check"),
  plain("application"),
];

function kindsAfterDropping(dropped: number[], visualFloor: "drawn" | "none" | "pictures") {
  const [spec] = dropDecorativePictures({
    judged: dropped.map((screen) => ({ lesson: 0, screen, teaches: false })),
    specs: [lessonOf(screens)],
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

  it("keeps a private lesson's scene drawn when its picture goes", () => {
    expect(kindsAfterDropping([0], "drawn")?.[0]).toStrictEqual(["table", null]);
    expect(kindsAfterDropping([0], "none")?.[0]).toStrictEqual(["none", null]);
  });
});

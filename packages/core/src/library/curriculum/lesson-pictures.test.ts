import { type LessonScreen, type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { describe, expect, it } from "vitest";
import { type JudgedPicture, dropDecorativePictures } from "./lesson-pictures";

function screen(kind: LessonScreen["kind"], visual: string | null = null): LessonScreen {
  return { activityTemplate: null, brief: kind, kind, skills: kind === "hook" ? [] : [0], visual };
}

/** Six explanations, so a new learner's lesson needs a visual on two of them. */
const spec: LessonSpec = {
  canDo: "Tell assets from debts",
  description: "What a business owns and owes.",
  estimatedMinutes: 4,
  screens: [
    screen("hook", "The shop"),
    screen("explanation", "Shelves of goods"),
    screen("explanation", "A delivery van"),
    screen("check", "A receipt"),
    screen("explanation", "A bank loan letter"),
    screen("explanation"),
    screen("check"),
    screen("explanation"),
    screen("explanation"),
    screen("application"),
  ],
  skills: [
    {
      description: "d",
      example: "e",
      hard: false,
      name: "Tell assets",
      topic: "Assets",
      useCase: "u",
    },
  ],
  supportMode: "explanationFirst",
  title: "Assets and debts",
};

const judged: JudgedPicture[] = [
  { lesson: 0, probability: 0.3, screen: 1, teaches: false },
  { lesson: 0, probability: 0.4, screen: 2, teaches: false },
  { lesson: 0, probability: 0.44, screen: 3, teaches: false },
  { lesson: 0, probability: 0.1, screen: 4, teaches: false },
];

function visuals(specs: LessonSpec[]) {
  return specs[0]?.screens.map((item) => item.visual);
}

describe(dropDecorativePictures, () => {
  it("drops every decorative picture for an experienced learner", () => {
    expect(visuals(dropDecorativePictures({ judged, novice: false, specs: [spec] }))).toStrictEqual(
      ["The shop", null, null, null, null, null, null, null, null, null],
    );
  });

  it("keeps a new learner's best-scored teaching pictures the visual floor needs", () => {
    expect(visuals(dropDecorativePictures({ judged, novice: true, specs: [spec] }))).toStrictEqual([
      "The shop",
      "Shelves of goods",
      "A delivery van",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

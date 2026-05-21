import { type LessonKind } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { getLessonKindTone } from "./lesson-kind-tones";

const LANGUAGE_LESSON_KINDS = [
  "alphabet",
  "custom",
  "grammar",
  "listening",
  "reading",
  "review",
  "translation",
  "vocabulary",
] satisfies LessonKind[];

const NON_LANGUAGE_LESSON_KINDS = [
  "custom",
  "explanation",
  "practice",
  "quiz",
  "review",
  "tutorial",
] satisfies LessonKind[];

describe(getLessonKindTone, () => {
  it("uses one tone per language lesson kind", () => {
    const tones = LANGUAGE_LESSON_KINDS.map((kind) => getLessonKindTone({ kind }));

    expect(new Set(tones).size).toBe(tones.length);
  });

  it("uses one tone per non-language lesson kind", () => {
    const tones = NON_LANGUAGE_LESSON_KINDS.map((kind) => getLessonKindTone({ kind }));

    expect(new Set(tones).size).toBe(tones.length);
  });
});

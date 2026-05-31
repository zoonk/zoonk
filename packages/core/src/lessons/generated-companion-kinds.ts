import { type Lesson } from "@zoonk/db";

export type GeneratedCompanionLessonKind = Extract<Lesson["kind"], "listening" | "translation">;
export type GeneratedCompanionSourceKind = Extract<Lesson["kind"], "reading" | "vocabulary">;
export type StandaloneGeneratedLessonKind = Exclude<
  Lesson["kind"],
  "custom" | "listening" | "review" | "translation"
>;

export const NON_STANDALONE_GENERATED_LESSON_KINDS = [
  "custom",
  "listening",
  "review",
  "translation",
] as const satisfies readonly Lesson["kind"][];

const NON_STANDALONE_GENERATED_LESSON_KIND_SET = new Set<Lesson["kind"]>(
  NON_STANDALONE_GENERATED_LESSON_KINDS,
);

const GENERATED_COMPANION_SOURCE_KINDS = {
  listening: "reading",
  translation: "vocabulary",
} as const satisfies Record<GeneratedCompanionLessonKind, GeneratedCompanionSourceKind>;

const GENERATED_COMPANION_TARGET_KINDS = {
  reading: "listening",
  vocabulary: "translation",
} as const satisfies Record<GeneratedCompanionSourceKind, GeneratedCompanionLessonKind>;

/** Translation and listening rows are materialized by their source lesson workflow. */
export function isGeneratedCompanionLessonKind(
  kind: Lesson["kind"],
): kind is GeneratedCompanionLessonKind {
  return kind === "listening" || kind === "translation";
}

/** Standalone lesson kinds have their own generation workflow entry point. */
export function isStandaloneGeneratedLessonKind(
  kind: Lesson["kind"],
): kind is StandaloneGeneratedLessonKind {
  return !NON_STANDALONE_GENERATED_LESSON_KIND_SET.has(kind);
}

/** Returns the source kind that owns a generated companion row, when applicable. */
export function getGeneratedCompanionSourceKind(
  kind: Lesson["kind"],
): GeneratedCompanionSourceKind | null {
  return isGeneratedCompanionLessonKind(kind) ? GENERATED_COMPANION_SOURCE_KINDS[kind] : null;
}

/** Returns the companion kind materialized by a source row, when applicable. */
export function getGeneratedCompanionTargetKind(
  kind: Lesson["kind"],
): GeneratedCompanionLessonKind | null {
  if (kind !== "reading" && kind !== "vocabulary") {
    return null;
  }

  return GENERATED_COMPANION_TARGET_KINDS[kind];
}

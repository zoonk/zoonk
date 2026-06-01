import { type LessonKind } from "@zoonk/db";
import { type JsonObject, isJsonObject } from "@zoonk/utils/json";

export type LessonKindFilterSettings = JsonObject & { hiddenLessonKinds: LessonKind[] };

const LANGUAGE_COURSE_LESSON_FILTER_KINDS = [
  "alphabet",
  "grammar",
  "listening",
  "reading",
  "review",
  "translation",
  "vocabulary",
] as const satisfies readonly LessonKind[];

const CONTENT_COURSE_LESSON_FILTER_KINDS = [
  "custom",
  "explanation",
  "practice",
  "quiz",
  "review",
  "tutorial",
] as const satisfies readonly LessonKind[];

const SUPPORTED_LESSON_FILTER_KINDS = [
  "alphabet",
  "custom",
  "explanation",
  "grammar",
  "listening",
  "practice",
  "quiz",
  "reading",
  "review",
  "translation",
  "tutorial",
  "vocabulary",
] as const satisfies readonly LessonKind[];

const SUPPORTED_LESSON_FILTER_KIND_SET = new Set<string>(SUPPORTED_LESSON_FILTER_KINDS);

/**
 * Course families have different lesson vocabularies. Showing only lesson kinds
 * that belong to the current family and are present in the chapter keeps the
 * menu short instead of exposing the whole database enum everywhere.
 */
export function getFilterableLessonKinds({
  isLanguageCourse,
  lessonKinds,
}: {
  isLanguageCourse: boolean;
  lessonKinds: LessonKind[];
}): LessonKind[] {
  const presentLessonKinds = new Set(lessonKinds);

  const courseKinds = isLanguageCourse
    ? LANGUAGE_COURSE_LESSON_FILTER_KINDS
    : CONTENT_COURSE_LESSON_FILTER_KINDS;

  return courseKinds.filter((kind) => presentLessonKinds.has(kind));
}

/**
 * Saved filter JSON can outlive enum changes, so every saved value needs to be
 * checked against the lesson kinds this UI still knows how to filter.
 */
function isFilterableLessonKind(kind: unknown): kind is LessonKind {
  return typeof kind === "string" && SUPPORTED_LESSON_FILTER_KIND_SET.has(kind);
}

/**
 * Stored preferences come from a JSON column, so this narrows the value to the
 * object shape the lesson filter can safely merge with without trusting arrays,
 * null, or primitive values as user settings.
 */
function getPreferenceObject(preferences: unknown): JsonObject {
  if (isJsonObject(preferences)) {
    return preferences;
  }

  return {};
}

/**
 * Hidden lesson kinds are stored as a user preference, but filtering must stay
 * deterministic for hydration and tests. Returning canonical enum order removes
 * duplicates and ignores stale values from older saved preferences.
 */
export function getHiddenLessonKindsFromPreferences(preferences: unknown): LessonKind[] {
  const value = getPreferenceObject(preferences).hiddenLessonKinds;

  if (!Array.isArray(value)) {
    return [];
  }

  const hiddenLessonKinds = new Set(value.filter((item) => isFilterableLessonKind(item)));
  return SUPPORTED_LESSON_FILTER_KINDS.filter((kind) => hiddenLessonKinds.has(kind));
}

/**
 * Toggling one kind should preserve the same canonical array shape that is
 * saved to the database, regardless of the order or duplicates in the current
 * client state.
 */
export function getNextHiddenLessonKinds({
  currentHiddenLessonKinds,
  isHidden,
  kind,
}: {
  currentHiddenLessonKinds: LessonKind[];
  isHidden: boolean;
  kind: LessonKind;
}): LessonKind[] {
  const hiddenLessonKinds = new Set(
    currentHiddenLessonKinds.filter((item) => isFilterableLessonKind(item)),
  );

  if (isHidden) {
    hiddenLessonKinds.add(kind);
  } else {
    hiddenLessonKinds.delete(kind);
  }

  return SUPPORTED_LESSON_FILTER_KINDS.filter((item) => hiddenLessonKinds.has(item));
}

/**
 * A user preference can hide kinds from another course family. The current
 * page should only apply hidden kinds controlled by the menu it is showing.
 */
export function getHiddenLessonKindsForFilter({
  filterableLessonKinds,
  hiddenLessonKinds,
}: {
  filterableLessonKinds: LessonKind[];
  hiddenLessonKinds: LessonKind[];
}): LessonKind[] {
  const hiddenLessonKindSet = new Set(
    hiddenLessonKinds.filter((item) => isFilterableLessonKind(item)),
  );

  return filterableLessonKinds.filter((kind) => hiddenLessonKindSet.has(kind));
}

/**
 * Clearing filters on a language course should not erase a learner's saved
 * non-language preferences, and the inverse is also true.
 */
export function getClearedHiddenLessonKinds({
  currentHiddenLessonKinds,
  filterableLessonKinds,
}: {
  currentHiddenLessonKinds: LessonKind[];
  filterableLessonKinds: LessonKind[];
}): LessonKind[] {
  const filterableLessonKindSet = new Set(filterableLessonKinds);

  return SUPPORTED_LESSON_FILTER_KINDS.filter(
    (kind) => currentHiddenLessonKinds.includes(kind) && !filterableLessonKindSet.has(kind),
  );
}

/**
 * Lesson filters share the broader learning-profile preferences object, so
 * updates replace only the hidden lesson kinds while keeping unrelated saved
 * preferences intact.
 */
export function getUpdatedLessonFilterSettings({
  hiddenLessonKinds,
  preferences,
}: {
  hiddenLessonKinds: LessonKind[];
  preferences: unknown;
}): LessonKindFilterSettings {
  return {
    ...getPreferenceObject(preferences),
    hiddenLessonKinds: getHiddenLessonKindsFromPreferences({ hiddenLessonKinds }),
  };
}

import { type LessonKind } from "@zoonk/db";
import { type GridItemTone } from "@zoonk/ui/components/grid";

const LESSON_KIND_TONES: Record<LessonKind, GridItemTone> = {
  alphabet: "blue",
  custom: "gray",
  explanation: "blue",
  grammar: "purple",
  listening: "red",
  practice: "green",
  quiz: "yellow",
  reading: "yellow",
  review: "brown",
  translation: "orange",
  tutorial: "purple",
  vocabulary: "green",
};

/**
 * Chapter pages show one generated lesson family at a time. This lookup keeps
 * lesson-kind badges stable without making the list calculate colors from row
 * order, which would change the meaning of a color as lessons are added.
 */
export function getLessonKindTone({ kind }: { kind: LessonKind }) {
  return LESSON_KIND_TONES[kind];
}

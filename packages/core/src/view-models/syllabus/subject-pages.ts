import { type GoalKind } from "@zoonk/db";
import { type SyllabusView } from "./syllabus-contract";

/** Language units and single-course paths keep plan numbering; exams and multi-module plans use subject pages. */
export function hasSubjectPages({
  goalKind,
  syllabus,
}: {
  goalKind: GoalKind;
  syllabus: { kind: SyllabusView["kind"]; subjects: readonly unknown[] };
}): boolean {
  if (goalKind === "language") {
    return false;
  }

  return syllabus.kind === "notice" || syllabus.subjects.length > 1;
}

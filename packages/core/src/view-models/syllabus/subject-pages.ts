import { type GoalKind } from "@zoonk/db";
import { type SyllabusView } from "./syllabus-contract";

/**
 * Whether a goal's subjects have pages of their own, which number its chapters: an exam's notice,
 * or at least two modules. A language's units and a plan from one course already read as its
 * path, so their chapters go by the plan.
 */
export function hasSubjectPages({
  goalKind,
  syllabus,
}: {
  goalKind: GoalKind;
  syllabus: Pick<SyllabusView, "kind" | "subjects">;
}): boolean {
  if (goalKind === "language") {
    return false;
  }

  return syllabus.kind === "notice" || syllabus.subjects.length > 1;
}

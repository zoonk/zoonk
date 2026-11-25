import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";

export function namesModules(goalKind: SyllabusView["goal"]["kind"]): boolean {
  return goalKind !== "exam";
}

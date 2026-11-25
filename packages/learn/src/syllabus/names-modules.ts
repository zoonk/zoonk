import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";

/** An exam's plan lists subjects; any other goal's plan calls them modules, on every screen. */
export function namesModules(goalKind: SyllabusView["goal"]["kind"]): boolean {
  return goalKind !== "exam";
}

import { type StoredChange } from "../contract";
import { findStoredHandler } from "../handlers/registry";
import { type FixUnit } from "./resolved-change";

export function cacheUnits(data: { changes: StoredChange[]; unit: FixUnit }): FixUnit[] {
  const roots = data.changes.map((change) => findStoredHandler(change).planRoots(change));

  return [
    data.unit,
    ...roots.flatMap((root): FixUnit[] => [
      ...(root.chapterIds ?? []).map((id) => ({ id, kind: "chapter" as const })),
      ...(root.courseIds ?? []).map((id) => ({ id, kind: "course" as const })),
      ...(root.lessonIds ?? []).map((id) => ({ id, kind: "lesson" as const })),
      ...(root.skillIds ?? []).map((id) => ({ id, kind: "skill" as const })),
      ...(root.blueprintIds ?? []).map((id) => ({ id, kind: "examBlueprint" as const })),
    ]),
  ];
}

import { type FocusPart } from "./focus-part-names";

type FocusOperation = { areas: string[]; kind: "focusAreas"; parts?: FocusPart[] };
type ReduceOperation = { areas: string[]; kind: "reduceAreas" };

function isFocus(operation: { kind: string }): operation is FocusOperation {
  return operation.kind === "focusAreas";
}

function isReduce(operation: { kind: string }): operation is ReduceOperation {
  return operation.kind === "reduceAreas";
}

/**
 * An area the learner wants less of is never in a focus, which would give it more time: a model
 * may name every area of "mais Processo Civil e menos Filosofia" in the focus. A focus on part of
 * an area wins over less time for the whole area ("mais biologia, física pode ser menos" in a
 * sciences area): the part's focus already gives the rest less. A change left with no area is
 * dropped; every other change passes through as it is.
 */
export function keepReducedOutOfFocus<T extends { kind: string }>(operations: readonly T[]): T[] {
  const narrowed = new Set(
    operations.flatMap((operation) =>
      isFocus(operation) ? (operation.parts ?? []).map((part) => part.area) : [],
    ),
  );

  const reduced = new Set(
    operations.flatMap((operation) =>
      isReduce(operation) ? operation.areas.filter((area) => !narrowed.has(area)) : [],
    ),
  );

  return operations.flatMap((operation): T[] => {
    if (isReduce(operation)) {
      const areas = operation.areas.filter((area) => reduced.has(area));
      return areas.length > 0 ? [{ ...operation, areas }] : [];
    }

    if (!isFocus(operation)) {
      return [operation];
    }

    const areas = operation.areas.filter((area) => !reduced.has(area));
    const parts = (operation.parts ?? []).filter((part) => areas.includes(part.area));

    return areas.length > 0 ? [{ ...operation, areas, parts }] : [];
  });
}

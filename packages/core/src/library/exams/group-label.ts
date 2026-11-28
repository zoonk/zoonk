import { listSubjectGroups } from "@zoonk/utils/exam-groups";
import { type ExamStructure } from "./blueprint-contract";

/**
 * The heading a subject is listed under: every part that tests it, in the order the notice scores
 * them, so the subjects two phases share sit together rather than under either phase alone.
 */
export function getGroupLabel({
  structure,
  subject,
}: {
  structure: Pick<ExamStructure, "mock">;
  subject: Pick<ExamStructure["subjects"][number], "group" | "otherGroups">;
}): string | null {
  const order = (structure.mock?.scoring.parts ?? []).map((part) => part.name);
  const rank = (name: string) => (order.includes(name) ? order.indexOf(name) : order.length);
  const groups = listSubjectGroups(subject).toSorted((first, second) => rank(first) - rank(second));

  return groups.length > 0 ? groups.join(" · ") : null;
}

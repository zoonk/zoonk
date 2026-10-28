import { normalizeString } from "@zoonk/utils/string";
import { namesMatch } from "../../exams/_utils/name-match";
import { type ExamStructure } from "./blueprint-contract";

type Subject = ExamStructure["subjects"][number];

function isSameName(first: Subject, second: Subject): boolean {
  return normalizeString(first.name) === normalizeString(second.name);
}

function findStoredSubject({
  current,
  next,
  subject,
}: {
  current: readonly Subject[];
  next: readonly Subject[];
  subject: Subject;
}): Subject | null {
  const exact = current.find((stored) => isSameName(stored, subject));

  if (exact) {
    return exact;
  }

  const named = new Set(
    next.flatMap((item) => current.filter((stored) => isSameName(stored, item))),
  );

  const candidates = current.filter(
    (stored) => !named.has(stored) && namesMatch(stored.name, subject.name),
  );

  const [candidate] = candidates;

  const rivals = candidate
    ? next.filter(
        (item) =>
          !current.some((stored) => isSameName(stored, item)) &&
          namesMatch(candidate.name, item.name),
      )
    : [];

  return candidates.length === 1 && rivals.length === 1 ? (candidate ?? null) : null;
}

function withoutUndefined(values: Record<string, unknown>): Partial<Subject> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

function withStoredFacts({ stored, subject }: { stored: Subject; subject: Subject }): Subject {
  return {
    ...subject,
    ...withoutUndefined({
      choiceGroup: subject.choiceGroup ?? stored.choiceGroup,
      group: subject.group ?? stored.group,
      name: stored.name,
      partOf: subject.partOf ?? stored.partOf,
      questions: subject.questions ?? stored.questions,
      shortName: subject.shortName ?? stored.shortName,
      topicGroups: subject.topicGroups?.length ? subject.topicGroups : stored.topicGroups,
      topics: subject.topics.length > 0 ? subject.topics : stored.topics,
      weight: subject.weight ?? stored.weight,
    }),
  };
}

function addLeftOut({
  current,
  merged,
}: {
  current: readonly Subject[];
  merged: Subject[];
}): Subject[] {
  return current.reduce<Subject[]>((subjects, stored, index) => {
    if (subjects.some((subject) => isSameName(subject, stored))) {
      return subjects;
    }

    const before = current[index - 1];
    const at = before ? subjects.findIndex((subject) => isSameName(subject, before)) + 1 : 0;

    return [...subjects.slice(0, at), stored, ...subjects.slice(at)];
  }, merged);
}

export function keepKnownSubjectFacts({
  current,
  next,
}: {
  current: readonly Subject[];
  next: readonly Subject[];
}): Subject[] {
  const merged = next.map((subject) => {
    const stored = findStoredSubject({ current, next, subject });
    return stored ? withStoredFacts({ stored, subject }) : subject;
  });

  return addLeftOut({ current, merged });
}

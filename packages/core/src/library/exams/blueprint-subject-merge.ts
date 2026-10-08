import { normalizeString } from "@zoonk/utils/string";
import { namesMatch } from "../../exams/_utils/name-match";
import { type ExamStructure } from "./blueprint-contract";

type Subject = ExamStructure["subjects"][number];

function isSameName(first: Subject, second: Subject): boolean {
  return normalizeString(first.name) === normalizeString(second.name);
}

/**
 * The stored subject a new reading's subject is: the one of the same name, or else the one its
 * name's words match ("Prova de Redação" for "Redação"), when that's the only stored subject it
 * matches and no other of the reading's subjects matches it. A stored subject another of the
 * reading's subjects has by name is never taken ("Direito Civil" isn't "Direito Processual Civil").
 */
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
      group: subject.group ?? stored.group,
      name: stored.name,
      questions: subject.questions ?? stored.questions,
      shortName: subject.shortName ?? stored.shortName,
      topicGroups: subject.topicGroups?.length ? subject.topicGroups : stored.topicGroups,
      topics: subject.topics.length > 0 ? subject.topics : stored.topics,
      weight: subject.weight ?? stored.weight,
    }),
  };
}

/**
 * The stored subjects the new reading left out, each placed after the stored subject before it,
 * so the notice's order holds.
 */
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

/**
 * A new reading's subjects with what the stored reading already knew: each subject it reads again
 * keeps its name, so plans, lookups and screens keep finding it, and its question count, weight,
 * group, short name, topics and their headings wherever the new reading leaves them out; a subject
 * it leaves out stays. A reading that names a subject differently, reads fewer documents or skips
 * one hasn't changed the exam (ENEM read again from its reference matrix states no counts and
 * calls its essay "Prova de Redação"; an OAB reading once missed Ética): one that states a new
 * count or group replaces it, and subjects it adds are added.
 */
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

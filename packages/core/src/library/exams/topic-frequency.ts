import { MS_PER_DAY } from "@zoonk/utils/date";
import { normalizeString } from "@zoonk/utils/string";
import { namesMatch } from "../../exams/_utils/name-match";
import { type ExamStructure, type TopicFrequency } from "./blueprint-contract";
import { toStems, toTopicKey } from "./topic-key";

type Subject = ExamStructure["subjects"][number];

export type TopicLevel = { level: TopicFrequency[number]["level"]; subject: string; topic: string };

export type TopicFrequencySource = { basis: string; title: string | null; url: string };

const MIN_RANKED_TOPICS = 4;

const MIN_RATED_SHARE = 1 / 3;

const RETRY_AFTER_DAYS = 30;

function findSubject({ name, structure }: { name: string; structure: ExamStructure }) {
  const wanted = normalizeString(name);

  const exact = structure.subjects.find(
    (subject) =>
      normalizeString(subject.name) === wanted ||
      (subject.shortName && normalizeString(subject.shortName) === wanted),
  );

  const matching = structure.subjects.filter(
    (subject) =>
      namesMatch(subject.name, name) || (subject.shortName && namesMatch(subject.shortName, name)),
  );

  return exact ?? (matching.length === 1 ? matching[0] : undefined);
}

function sharesStems({ name, topic }: { name: string; topic: string }): boolean {
  const wanted = toStems(name);
  const own = new Set(toStems(topic));

  return wanted.length > 0 && wanted.every((stem) => own.has(stem));
}

function findOnly({
  matches,
  topics,
}: {
  matches: (topic: string) => boolean;
  topics: readonly string[];
}): string | null {
  const found = topics.filter((item) => matches(item));
  return found.length === 1 ? (found[0] ?? null) : null;
}

function findTopic({ subject, topic }: { subject: Subject; topic: string }): string | null {
  const wanted = toTopicKey(topic);
  const exact = subject.topics.find((item) => toTopicKey(item) === wanted);

  if (exact !== undefined || !wanted) {
    return exact ?? null;
  }

  const containing = subject.topics.filter((item) => {
    const key = toTopicKey(item);
    return key.includes(wanted) || wanted.includes(key);
  });

  if (containing.length > 0) {
    return containing.length === 1 ? (containing[0] ?? null) : null;
  }

  return findOnly({
    matches: (item) => sharesStems({ name: topic, topic: item }),
    topics: subject.topics,
  });
}

function readPaperLevels({
  structure,
  topicFrequency,
}: {
  structure: ExamStructure;
  topicFrequency: TopicFrequency;
}): TopicLevel[] {
  return topicFrequency.flatMap((entry) => {
    const subject = findSubject({ name: entry.subject, structure });
    const topic = subject ? findTopic({ subject, topic: entry.topic }) : null;

    return subject && topic ? [{ level: entry.level, subject: subject.name, topic }] : [];
  });
}

function readLookupLevels(structure: ExamStructure): TopicLevel[] {
  return (structure.pastTopicFrequency?.subjects ?? []).flatMap((found) => {
    const subject = findSubject({ name: found.name, structure });

    return subject
      ? found.topics.flatMap((entry) => {
          const topic = findTopic({ subject, topic: entry.topic });
          return topic ? [{ level: entry.level, subject: subject.name, topic }] : [];
        })
      : [];
  });
}

function toLevelKey(level: Pick<TopicLevel, "subject" | "topic">): string {
  return `${normalizeString(level.subject)}|${toTopicKey(level.topic)}`;
}

export function listTopicLevels({
  structure,
  topicFrequency,
}: {
  structure: ExamStructure;
  topicFrequency: TopicFrequency;
}): TopicLevel[] {
  const levels = [
    ...readPaperLevels({ structure, topicFrequency }),
    ...readLookupLevels(structure),
  ];

  return levels.filter(
    (level, index) =>
      levels.findIndex((other) => toLevelKey(other) === toLevelKey(level)) === index,
  );
}

function isRecent({ checkedAt, now }: { checkedAt: string; now: Date }): boolean {
  return now.getTime() - new Date(checkedAt).getTime() < RETRY_AFTER_DAYS * MS_PER_DAY;
}

export function listUnratedSubjects({
  structure,
  topicFrequency,
}: {
  structure: ExamStructure;
  topicFrequency: TopicFrequency;
}): Subject[] {
  const levels = listTopicLevels({ structure, topicFrequency });

  return structure.subjects.filter((subject) => {
    const rated = levels.filter((level) => level.subject === subject.name).length;

    return (
      subject.topics.length >= MIN_RANKED_TOPICS && rated < subject.topics.length * MIN_RATED_SHARE
    );
  });
}

export function needsTopicFrequency({
  now,
  structure,
  topicFrequency,
}: {
  now: Date;
  structure: ExamStructure;
  topicFrequency: TopicFrequency;
}): boolean {
  const checkedAt = structure.pastTopicFrequency?.checkedAt;

  if (checkedAt && isRecent({ checkedAt, now })) {
    return false;
  }

  return listUnratedSubjects({ structure, topicFrequency }).length > 0;
}

export function getTopicFrequencySource({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: Pick<Subject, "name">;
}): TopicFrequencySource | null {
  const found = structure.pastTopicFrequency?.subjects.find(
    (entry) => findSubject({ name: entry.name, structure })?.name === subject.name,
  );

  return found && found.topics.length > 0
    ? { basis: found.basis, title: found.source.title, url: found.source.url }
    : null;
}

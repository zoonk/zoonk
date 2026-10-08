import { MS_PER_DAY } from "@zoonk/utils/date";
import { normalizeString } from "@zoonk/utils/string";
import { namesMatch } from "../../exams/_utils/name-match";
import { type ExamStructure, type TopicFrequency } from "./blueprint-contract";
import { toStems, toTopicKey } from "./topic-key";

type Subject = ExamStructure["subjects"][number];

/** A notice topic and how often the exam asks it, in the notice's own words. */
export type TopicLevel = { level: TopicFrequency[number]["level"]; subject: string; topic: string };

/** A notice topic and the part of its subject the notice lists it under (ENEM's "Biologia"). */
export type TopicPart = { part: string; subject: string; topic: string };

/** Each topic the notice lists under one of its subjects' headings, with that heading. */
export function listTopicParts(structure: ExamStructure): TopicPart[] {
  return structure.subjects.flatMap((subject) =>
    (subject.topicGroups ?? []).flatMap((group) =>
      group.topics.map((topic) => ({ part: group.name, subject: subject.name, topic })),
    ),
  );
}

/** Where a subject's topic frequency comes from, for the line that cites it. */
export type TopicFrequencySource = { basis: string; title: string | null; url: string };

/**
 * Subjects with fewer topics than this aren't worth looking up: a plan short on time trims their
 * depth, and every one of them stays in.
 */
const MIN_RANKED_TOPICS = 4;

/**
 * A subject counts as ranked once this share of its topics is rated: a reading of past papers that
 * names one of ENEM's 23 science contents ("Ecologia") ranks nothing else.
 */
const MIN_RATED_SHARE = 1 / 3;

/** A lookup that found nothing is tried again after this long: a source may publish its counts. */
const RETRY_AFTER_DAYS = 30;

/** The notice's subject a name stands for: the same name or short name, else the one it matches. */
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

/** Whether every meaningful word of `name` has its stem among the topic's words. */
function sharesStems({ name, topic }: { name: string; topic: string }): boolean {
  const wanted = toStems(name);
  const own = new Set(toStems(topic));

  return wanted.length > 0 && wanted.every((stem) => own.has(stem));
}

/** The one topic of the list that passes `matches`, or null when none or several do. */
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

/**
 * The subject's topic a past-paper reading names: the same words, else the one topic that contains
 * them or that they contain ("Ecologia" for "Ecologia e ciências ambientais"), else the one whose
 * words share the stems of all of its words ("Eletricidade" for "Fenômenos Elétricos e
 * Magnéticos"), so a reading that uses a topic's usual name still rates the notice's topic.
 */
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

/** What a reading of the exam's past papers says, on the notice's subjects and topics. */
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

/** What the lookup found, on the subjects and topics the notice still has. */
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

/**
 * How often the exam asks each of its notice's topics, where something says: a reading of its past
 * papers first, then the lookup for the topics that reading doesn't rate. Each topic once, in the
 * notice's own words.
 */
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

/** The subjects with several topics of which few or none are rated: the ones a lookup ranks. */
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

/**
 * Whether research looks up how often the exam asks its topics: a subject with several topics has
 * none rated (by its past papers or a lookup), and no lookup ran in the last month, when a source
 * may have published what the last one didn't find.
 */
export function needsTopicFrequency({
  now,
  structure,
  topicFrequency,
}: {
  now: Date;
  structure: ExamStructure;
  topicFrequency: TopicFrequency;
}): boolean {
  const past = structure.pastTopicFrequency;

  if (past && isRecent({ checkedAt: past.checkedAt, now })) {
    return false;
  }

  return listUnratedSubjects({ structure, topicFrequency }).length > 0;
}

/** Where the lookup found how often a subject's topics are asked; null when it found nothing. */
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

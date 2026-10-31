import { namesMatchAcrossSpellings } from "@zoonk/utils/name-words";
import { normalizeString } from "@zoonk/utils/string";

type ExamSubject = {
  /** For one of several subjects candidates pick from: no other skill builds on an option's. */
  choiceGroup?: string | null;
  name: string;
  /**
   * What learners call a long-named subject ("Professional Ethics"): an area by it is this subject.
   */
  shortName?: string | null;
  group: string | null;
  questions: number | null;
  /** Share of the final score, 0 to 1. */
  weight: number | null;
  /** In the notice's words and order. */
  topics: string[];
};

export type ExamOutline = {
  name: string;
  notes: string[];
  subjects: ExamSubject[];
  topicFrequency: { level: string; subject: string; topic: string }[];
};

const PERCENT = 100;
const TOPIC_ID_PATTERN = /^S(?<subject>\d+)\.(?<topic>\d+)$/u;

function toTopicId({ subject, topic }: { subject: number; topic: number }): string {
  return `S${subject + 1}.${topic + 1}`;
}

function describeSubject({ index, subject }: { index: number; subject: ExamSubject }): string {
  const details = [
    subject.group,
    subject.choiceGroup
      ? `an option of "${subject.choiceGroup}": each candidate takes only one option`
      : null,
    subject.questions === null ? null : `${subject.questions} questions`,
    subject.weight === null ? null : `weight ${Math.round(subject.weight * PERCENT)}%`,
  ].filter(Boolean);

  const heading = `S${index + 1}. ${subject.name}${details.length > 0 ? ` (${details.join("; ")})` : ""}`;

  const topics = subject.topics.map(
    (topic, topicIndex) => `  ${toTopicId({ subject: index, topic: topicIndex })} ${topic}`,
  );

  return [heading, ...topics].join("\n");
}

export function formatExamOutline(outline: ExamOutline): string {
  const subjects = outline.subjects.map((subject, index) => describeSubject({ index, subject }));

  const frequency = outline.topicFrequency.map(
    (topic) => `- ${topic.subject} / ${topic.topic}: ${topic.level}`,
  );

  return [
    `EXAM: ${outline.name}`,
    outline.notes.length > 0
      ? `NOTES:\n${outline.notes.map((note) => `- ${note}`).join("\n")}`
      : null,
    subjects.length > 0 ? `SUBJECTS:\n${subjects.join("\n")}` : null,
    frequency.length > 0 ? `TOPIC_FREQUENCY:\n${frequency.join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

type TopicRef = { subject: number; topic: string };

function findTopic({ outline, value }: { outline: ExamOutline; value: string }): TopicRef | null {
  const match = TOPIC_ID_PATTERN.exec(value.trim())?.groups;

  if (match) {
    const subject = Number(match.subject) - 1;
    const topic = outline.subjects[subject]?.topics[Number(match.topic) - 1];
    return topic === undefined ? null : { subject, topic };
  }

  const wanted = normalizeString(value);

  return outline.subjects.reduce<TopicRef | null>((found, subject, index) => {
    const topic = subject.topics.find((item) => normalizeString(item) === wanted);
    return found ?? (topic === undefined ? null : { subject: index, topic });
  }, null);
}

function findSubjectByName({ name, outline }: { name: string; outline: ExamOutline }) {
  const wanted = normalizeString(name);

  if (!wanted) {
    return -1;
  }

  const names = outline.subjects.map((subject) => normalizeString(subject.name));
  const exact = names.indexOf(wanted);

  if (exact !== -1) {
    return exact;
  }

  const short = outline.subjects.findIndex(
    (subject) => subject.shortName && normalizeString(subject.shortName) === wanted,
  );

  if (short !== -1) {
    return short;
  }

  const partial = names.flatMap((subject, index) =>
    subject.includes(wanted) || wanted.includes(subject) ? [index] : [],
  );

  if (partial.length > 0) {
    return partial.length === 1 ? (partial[0] ?? -1) : -1;
  }

  const respelled = outline.subjects.flatMap((subject, index) =>
    namesMatchAcrossSpellings(name, subject.name) ? [index] : [],
  );

  return respelled.length === 1 ? (respelled[0] ?? -1) : -1;
}

function findMainSubject(refs: readonly TopicRef[]): number {
  const counts = refs.reduce(
    (total, ref) => total.set(ref.subject, (total.get(ref.subject) ?? 0) + 1),
    new Map<number, number>(),
  );

  return (
    [...counts]
      .toSorted(([subjectA, countA], [subjectB, countB]) => countB - countA || subjectA - subjectB)
      .map(([subject]) => subject)[0] ?? -1
  );
}

/** Never on another option of a choice: a learner may take that one and never study it. */
export function canBuildOn({
  area,
  outline,
  prerequisiteArea,
}: {
  area: string;
  outline: ExamOutline;
  prerequisiteArea: string;
}): boolean {
  const isOption = outline.subjects.some(
    (subject) => subject.choiceGroup && subject.name === prerequisiteArea,
  );

  return !isOption || area === prerequisiteArea;
}

/**
 * Word for word, so the syllabus reads skills by plain equality. An area the notice doesn't have
 * (answer strategy) stays as written, with no topics.
 */
export function placeInExam({
  area,
  outline,
  topics,
}: {
  area: string;
  outline: ExamOutline;
  topics: readonly string[];
}): { area: string; topics: string[] } {
  const refs = topics.flatMap((value) => findTopic({ outline, value }) ?? []);
  const byTopics = findMainSubject(refs);
  const subjectIndex = byTopics === -1 ? findSubjectByName({ name: area, outline }) : byTopics;
  const subject = outline.subjects[subjectIndex];

  if (!subject) {
    return { area: area.trim(), topics: [] };
  }

  const own = new Set(refs.filter((ref) => ref.subject === subjectIndex).map((ref) => ref.topic));

  return { area: subject.name, topics: subject.topics.filter((topic) => own.has(topic)) };
}

const TOPIC_NUMBER_PATTERN = /^(?<number>\d+(?:\.\d+)*)[.)]?\s/u;

function getTopicNumber(topic: string): string | null {
  return TOPIC_NUMBER_PATTERN.exec(topic)?.groups?.number ?? null;
}

function isSubTopic({ parent, topic }: { parent: string; topic: string }): boolean {
  const parentNumber = getTopicNumber(parent);
  const number = getTopicNumber(topic);

  return parentNumber !== null && number !== null && number.startsWith(`${parentNumber}.`);
}

/**
 * An item split into numbered sub-items is taught through them, so only the sub-items are listed.
 */
export function findUncoveredTopics({
  outline,
  skills,
}: {
  outline: ExamOutline;
  skills: readonly { area: string | null; topics: readonly string[] }[];
}): { subject: string; topic: string }[] {
  return outline.subjects.flatMap((subject) => {
    const covered = new Set(
      skills.flatMap((skill) => (skill.area === subject.name ? skill.topics : [])),
    );

    const hasSubTopics = (topic: string) =>
      subject.topics.some((other) => isSubTopic({ parent: topic, topic: other }));

    return subject.topics
      .filter((topic) => !covered.has(topic) && !hasSubTopics(topic))
      .map((topic) => ({ subject: subject.name, topic }));
  });
}

export function isTopicId(value: string): boolean {
  return TOPIC_ID_PATTERN.test(value.trim());
}

export function getTopicId({
  outline,
  subject,
  topic,
}: {
  outline: ExamOutline;
  subject: string;
  topic: string;
}): string | null {
  const subjectIndex = outline.subjects.findIndex((item) => item.name === subject);
  const topicIndex = outline.subjects[subjectIndex]?.topics.indexOf(topic) ?? -1;

  return topicIndex === -1 ? null : toTopicId({ subject: subjectIndex, topic: topicIndex });
}

/** How a Portuguese notice names a test answered in writing: discursive, essay, legal brief. */
const WRITTEN_TEST = /discursiv|reda[cç][aã]o|pe[cç]a t[eé]cnica/iu;

/**
 * Every candidate sits it and it's scored apart, so a plan short on time keeps its skills whole.
 */
export function isWrittenTestSubject(subject: Pick<ExamSubject, "group" | "name">): boolean {
  return WRITTEN_TEST.test(`${subject.name} ${subject.group ?? ""}`);
}

import { normalizeString } from "@zoonk/utils/string";

/** One subject of an exam's notice, as the curriculum maps skills onto it. */
type ExamSubject = {
  name: string;
  /** The part of the exam the notice puts it in, such as "Conhecimentos básicos (P1)". */
  group: string | null;
  questions: number | null;
  /** Its share of the final score, from 0 to 1. */
  weight: number | null;
  /** Every item of its syllabus, in the notice's words and order. */
  topics: string[];
};

/**
 * What the curriculum reads of an exam's blueprint: its subjects with their topics, what the
 * notice says about its format, scoring and rules, and how often the board asks each topic.
 */
export type ExamOutline = {
  name: string;
  /** The notice's format, scoring and rules, one line each. */
  notes: string[];
  subjects: ExamSubject[];
  topicFrequency: { level: string; subject: string; topic: string }[];
};

const PERCENT = 100;
const TOPIC_ID_PATTERN = /^S(?<subject>\d+)\.(?<topic>\d+)$/u;

/** A topic's id in the prompts: its subject's number and its own, such as "S2.5". */
function toTopicId({ subject, topic }: { subject: number; topic: number }): string {
  return `S${subject + 1}.${topic + 1}`;
}

function describeSubject({ index, subject }: { index: number; subject: ExamSubject }): string {
  const details = [
    subject.group,
    subject.questions === null ? null : `${subject.questions} questions`,
    subject.weight === null ? null : `weight ${Math.round(subject.weight * PERCENT)}%`,
  ].filter(Boolean);

  const heading = `S${index + 1}. ${subject.name}${details.length > 0 ? ` (${details.join("; ")})` : ""}`;

  const topics = subject.topics.map(
    (topic, topicIndex) => `  ${toTopicId({ subject: index, topic: topicIndex })} ${topic}`,
  );

  return [heading, ...topics].join("\n");
}

/**
 * The exam as the skill graph and the coverage check read it: each subject numbered with its group,
 * question count or weight, and every topic of its syllabus under an id ("S2.5") that skills cite.
 */
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

/** A topic a model cited, by its id or, failing that, by its words in one of the subjects. */
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

/** The subject a name stands for: the same words, or a subject the name is part of or contains. */
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

  const partial = names.flatMap((subject, index) =>
    subject.includes(wanted) || wanted.includes(subject) ? [index] : [],
  );

  return partial.length === 1 ? (partial[0] ?? -1) : -1;
}

/** The subject most of the topics belong to; the earliest one on a tie. */
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

/**
 * A skill's place in an exam's notice from what a model wrote: its area becomes the notice's
 * subject, word for word, and its topics the notice's own topics of that subject, so the syllabus
 * reads skills by plain equality. The subject is the one most of its cited topics belong to, or the
 * one its area names. An area the notice doesn't have (the essay, answer strategy) stays as
 * written, with no topics.
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

/** The number a syllabus gives a topic ("5.7" in "5.7 Emprego do sinal indicativo de crase"). */
function getTopicNumber(topic: string): string | null {
  return TOPIC_NUMBER_PATTERN.exec(topic)?.groups?.number ?? null;
}

/** Whether a topic is one of the numbered sub-items of another ("5.7" of "5"). */
function isSubTopic({ parent, topic }: { parent: string; topic: string }): boolean {
  const parentNumber = getTopicNumber(parent);
  const number = getTopicNumber(topic);

  return parentNumber !== null && number !== null && number.startsWith(`${parentNumber}.`);
}

/**
 * The notice's topics no skill covers, by subject and in the notice's order: what the coverage
 * check fills before a plan is built, so the plan teaches the whole syllabus. An item split into
 * numbered sub-items ("5", then "5.1" to "5.8") is taught through them, so only the sub-items are
 * listed.
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

/** Whether a value is a topic's id in `formatExamOutline`, such as "S2.5". */
export function isTopicId(value: string): boolean {
  return TOPIC_ID_PATTERN.test(value.trim());
}

/** A topic's id in `formatExamOutline`, for prompts that name what's missing. */
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

/** How a notice names a test answered in writing: a discursive test, a redação, a peça técnica. */
const WRITTEN_TEST = /discursiv|reda[cç][aã]o|pe[cç]a t[eé]cnica/iu;

/**
 * Whether a notice subject is the exam's written test (its "Prova discursiva", in its own group):
 * every candidate sits it and it's scored apart, so a plan short on time keeps its skills whole.
 */
export function isWrittenTestSubject(subject: Pick<ExamSubject, "group" | "name">): boolean {
  return WRITTEN_TEST.test(`${subject.name} ${subject.group ?? ""}`);
}

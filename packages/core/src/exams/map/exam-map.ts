import { type MasteryState } from "@zoonk/db";
import { type ExamStructure, type TopicFrequency } from "../../library/exams/blueprint-contract";
import { namesMatch } from "../_utils/name-match";

type FrequencyLevel = TopicFrequency[number]["level"];

type ExamMapTopic = {
  /** Questions on it in the past papers read, such as "4 times" on last year's class exam. */
  appearances: number | null;
  /** How often the board asks it: "high" is "appears a lot". Null without past papers. */
  frequency: FrequencyLevel | null;
  name: string;
};

/** How far the learner is in a subject's skills: studied, then solid, then mastered. */
type ExamMapLevel = { mastered: number; solid: number; studied: number; total: number };

type ExamMapSubject = {
  /** The subject's most frequent topic level, so "appears a lot" can mark the subject. */
  frequency: FrequencyLevel | null;
  level: ExamMapLevel | null;
  name: string;
  questions: number | null;
  /** Its share of the exam, from 0 to 1: the notice's weight, or its share of the questions. */
  share: number | null;
  topics: ExamMapTopic[];
};

/**
 * The exam map ("what's on the exam"): the notice's subjects in order with their weight, each
 * topic with how often the board asks it, and where the learner stands in each subject. The plan's
 * priority already uses the same weights and frequency.
 */
export type ExamMap = { hasFrequency: boolean; subjects: ExamMapSubject[]; topicCount: number };

type ExamMapSkill = { area: string | null; state: MasteryState };

const FREQUENCY_RANK: Record<FrequencyLevel, number> = { high: 0, low: 2, medium: 1 };
const NO_FREQUENCY_RANK = 3;

function rank(topic: Pick<ExamMapTopic, "frequency">): number {
  return topic.frequency ? FREQUENCY_RANK[topic.frequency] : NO_FREQUENCY_RANK;
}

function getShare({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: ExamStructure["subjects"][number];
}): number | null {
  if (subject.weight !== null) {
    return subject.weight;
  }

  const total = structure.subjects.reduce((sum, item) => sum + (item.questions ?? 0), 0);
  return subject.questions !== null && total > 0 ? subject.questions / total : null;
}

function toTopics({
  frequency,
  subject,
}: {
  frequency: TopicFrequency;
  subject: ExamStructure["subjects"][number];
}): ExamMapTopic[] {
  const own = frequency.filter((entry) => namesMatch(entry.subject, subject.name));
  const findEntry = (topic: string) => own.find((entry) => namesMatch(entry.topic, topic));

  const listed = subject.topics.map((name) => {
    const entry = findEntry(name);
    return { appearances: entry?.appearances ?? null, frequency: entry?.level ?? null, name };
  });

  const extra = own
    .filter((entry) => !subject.topics.some((topic) => namesMatch(entry.topic, topic)))
    .map((entry) => ({
      appearances: entry.appearances,
      frequency: entry.level,
      name: entry.topic,
    }));

  return [...listed, ...extra].toSorted(
    (first, second) =>
      rank(first) - rank(second) || (second.appearances ?? 0) - (first.appearances ?? 0),
  );
}

function toLevel({
  skills,
  subject,
}: {
  skills: readonly ExamMapSkill[];
  subject: string;
}): ExamMapLevel | null {
  const own = skills.filter((skill) => skill.area && namesMatch(skill.area, subject));

  if (own.length === 0) {
    return null;
  }

  const count = (states: readonly MasteryState[]) =>
    own.filter((skill) => states.includes(skill.state)).length;

  return {
    mastered: count(["mastered"]),
    solid: count(["solid", "mastered"]),
    studied: count(["learning", "solid", "mastered"]),
    total: own.length,
  };
}

export function buildExamMap({
  frequency,
  skills,
  structure,
}: {
  frequency: TopicFrequency;
  skills: readonly ExamMapSkill[];
  structure: ExamStructure;
}): ExamMap {
  const subjects = structure.subjects.map((subject) => {
    const topics = toTopics({ frequency, subject });
    const top = topics.find((topic) => topic.frequency !== null)?.frequency ?? null;

    return {
      frequency: top,
      level: toLevel({ skills, subject: subject.name }),
      name: subject.name,
      questions: subject.questions,
      share: getShare({ structure, subject }),
      topics,
    };
  });

  return {
    hasFrequency: frequency.length > 0,
    subjects,
    topicCount: subjects.reduce((sum, subject) => sum + subject.topics.length, 0),
  };
}

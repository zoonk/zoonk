import { type MasteryState } from "@zoonk/db";
import { type ExamStructure, type TopicFrequency } from "../../library/exams/blueprint-contract";
import {
  getPastQuestionsSource,
  getSubjectQuestions,
  orderByQuestions,
} from "../../library/exams/subject-questions";
import { namesMatch } from "../_utils/name-match";
import { listCountedSubjects } from "../choices/exam-choices";

type FrequencyLevel = TopicFrequency[number]["level"];

type ExamMapTopic = { appearances: number | null; frequency: FrequencyLevel | null; name: string };

type ExamMapLevel = { mastered: number; solid: number; studied: number; total: number };

type ExamMapSubject = {
  frequency: FrequencyLevel | null;
  group: string | null;
  level: ExamMapLevel | null;
  name: string;
  questions: number | null;
  share: number | null;
  topics: ExamMapTopic[];
};

export type ExamMap = {
  hasFrequency: boolean;
  questionsSource: { edition: string | null; title: string | null; url: string } | null;
  subjects: ExamMapSubject[];
  topicCount: number;
};

type ExamMapSkill = { area: string | null; state: MasteryState };

const FREQUENCY_RANK: Record<FrequencyLevel, number> = { high: 0, low: 2, medium: 1 };
const NO_FREQUENCY_RANK = 3;

function rank(topic: Pick<ExamMapTopic, "frequency">): number {
  return topic.frequency ? FREQUENCY_RANK[topic.frequency] : NO_FREQUENCY_RANK;
}

export function getSubjectShare({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: ExamStructure["subjects"][number];
}): number | null {
  if (subject.weight !== null) {
    return subject.weight;
  }

  const questions = getSubjectQuestions({ structure, subject });

  const total = listCountedSubjects(structure.subjects).reduce(
    (sum, item) => sum + (getSubjectQuestions({ structure, subject: item }) ?? 0),
    0,
  );

  return questions !== null && total > 0 ? questions / total : null;
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
  const subjects = orderByQuestions(
    structure.subjects.map((subject) => {
      const topics = toTopics({ frequency, subject });
      const top = topics.find((topic) => topic.frequency !== null)?.frequency ?? null;

      return {
        frequency: top,
        group: subject.group ?? null,
        level: toLevel({ skills, subject: subject.name }),
        name: subject.name,
        questions: getSubjectQuestions({ structure, subject }),
        share: getSubjectShare({ structure, subject }),
        topics,
      };
    }),
  );

  return {
    hasFrequency: frequency.length > 0,
    questionsSource: getPastQuestionsSource(structure),
    subjects,
    topicCount: subjects.reduce((sum, subject) => sum + subject.topics.length, 0),
  };
}

import "server-only";
import { type GoalTutorLookUpResult } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { type Goal, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { getOutlinedUntil } from "../../../plans/_utils/stand-in-lessons";
import { buildSyllabus } from "../../../view-models/syllabus/_utils/build-syllabus";
import { loadSyllabusInput } from "../../../view-models/syllabus/_utils/load-syllabus";
import { type SyllabusInput } from "../../../view-models/syllabus/_utils/syllabus-input";
import {
  type SyllabusChapter,
  type SyllabusSubject,
  type SyllabusTopic,
} from "../../../view-models/syllabus/syllabus-contract";
import { matchesArea, matchesQuery } from "./lookup-text";

const MAX_SUBJECT_TOPICS = 80;
const MAX_TOPICS_EACH = 25;

const DONE_CHAPTERS = 2;
const CHAPTERS_AHEAD = 6;

const RECENT_DAYS = 28;

type Lookup = { area: string | null; goal: Goal; query: string | null };

async function loadSyllabus(goal: Goal) {
  const input = await loadSyllabusInput(goal);

  if (!input) {
    return null;
  }

  const today = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });
  return { input, syllabus: buildSyllabus({ ...input, outlinedUntil: getOutlinedUntil(today) }) };
}

function getSubjectNames(subject: SyllabusSubject): string[] {
  return [subject.name, subject.shortName, ...subject.areas];
}

function pickSubjects({
  area,
  subjects,
}: {
  area: string | null;
  subjects: readonly SyllabusSubject[];
}): SyllabusSubject[] {
  return area
    ? subjects.filter((subject) => matchesArea({ area, names: getSubjectNames(subject) }))
    : [...subjects];
}

function toTopic({
  heading,
  name,
  planned,
}: {
  heading: string | null;
  name: string;
  planned: SyllabusTopic | undefined;
}) {
  return {
    frequency: planned?.frequency ?? null,
    heading,
    name,
    nextDate: planned?.nextDate ?? null,
    notPlannedReason: planned?.notPlannedReason ?? null,
    status: planned?.status ?? null,
  };
}

function indexPlannedTopics(syllabus: { kind: string; subjects: readonly SyllabusSubject[] }) {
  const topics = syllabus.kind === "notice" ? syllabus.subjects : [];

  return new Map(
    topics.flatMap((subject) =>
      subject.topics.map((topic) => [`${subject.name}\n${topic.name}`, topic] as const),
    ),
  );
}

/** An empty match returns the notice's subjects so the caller can retry with one. */
export async function lookUpNoticeTopics({
  area,
  goal,
  query,
}: Lookup): Promise<GoalTutorLookUpResult> {
  const loaded = await loadSyllabus(goal);
  const what = "noticeTopics";
  const notice = loaded?.input.notice;

  if (!loaded || !notice) {
    return { reason: "notExam", status: "unavailable", what };
  }

  const planned = indexPlannedTopics(loaded.syllabus);
  const limit = area ? MAX_SUBJECT_TOPICS : MAX_TOPICS_EACH;

  const asked = area
    ? notice.subjects.filter((subject) =>
        matchesArea({ area, names: [subject.name, subject.shortName ?? subject.name] }),
      )
    : notice.subjects;

  const subjects = asked.flatMap((subject) => {
    const topics = subject.topics
      .map((name) =>
        toTopic({
          heading: subject.topicHeadings?.get(name) ?? null,
          name,
          planned: planned.get(`${subject.name}\n${name}`),
        }),
      )
      .filter(
        (topic) => !query || matchesQuery({ query, text: `${topic.heading ?? ""} ${topic.name}` }),
      );

    const shown = topics.slice(0, limit);

    return query && topics.length === 0
      ? []
      : [{ moreTopics: topics.length - shown.length, name: subject.name, topics: shown }];
  });

  if (subjects.length === 0) {
    return { areas: notice.subjects.map((subject) => subject.name), status: "notFound", what };
  }

  return { source: loaded.syllabus.noticeUrl, status: "found", subjects, what };
}

function loadAnswers({
  since,
  skillIds,
  userId,
}: {
  since: Date;
  skillIds: string[];
  userId: string;
}) {
  return prisma.attempt.groupBy({
    _count: { id: true },
    by: ["skillId", "isCorrect"],
    where: { answeredAt: { gte: since }, skillId: { in: skillIds }, userId },
  });
}

function loadOpenMistakes({ skillIds, userId }: { skillIds: string[]; userId: string }) {
  return prisma.mistake.groupBy({
    _count: { id: true },
    by: ["skillId"],
    where: { skillId: { in: skillIds }, status: "open", userId },
  });
}

function getSubjectSkillIds({
  input,
  subject,
}: {
  input: SyllabusInput;
  subject: SyllabusSubject;
}): Set<string> {
  return new Set(
    input.skills
      .filter((skill) => subject.areas.includes(skill.area))
      .map((skill) => skill.skillId),
  );
}

function toChapter(chapter: SyllabusChapter) {
  return {
    lessonsDone: chapter.lessonsDone,
    lessonsTotal: chapter.lessonsTotal,
    state: chapter.state,
    title: chapter.title,
  };
}

function pickChapters(chapters: readonly SyllabusChapter[]) {
  const done = chapters.filter((chapter) => chapter.state === "done").slice(-DONE_CHAPTERS);
  const ahead = chapters.filter((chapter) => chapter.state !== "done").slice(0, CHAPTERS_AHEAD);
  const shown = [...done, ...ahead];

  return {
    chapters: shown.map((chapter) => toChapter(chapter)),
    more: chapters.length - shown.length,
  };
}

export async function lookUpSubjectProgress({
  area,
  goal,
}: Lookup): Promise<GoalTutorLookUpResult> {
  const loaded = await loadSyllabus(goal);
  const what = "subjectProgress";

  if (!loaded) {
    return { status: "notFound", what };
  }

  const { input, syllabus } = loaded;
  const picked = pickSubjects({ area, subjects: syllabus.subjects });

  if (picked.length === 0) {
    return { areas: syllabus.subjects.map((subject) => subject.name), status: "notFound", what };
  }

  const bySubject = picked.map((subject) => ({
    skillIds: getSubjectSkillIds({ input, subject }),
    subject,
  }));

  const skillIds = [...new Set(bySubject.flatMap(({ skillIds: ids }) => [...ids]))];
  const since = new Date(Date.now() - RECENT_DAYS * MS_PER_DAY);

  const [answers, mistakes] = await Promise.all([
    loadAnswers({ since, skillIds, userId: goal.userId }),
    loadOpenMistakes({ skillIds, userId: goal.userId }),
  ]);

  const subjects = bySubject.map(({ skillIds: ids, subject }) => {
    const own = answers.filter((group) => group.skillId && ids.has(group.skillId));
    const total = own.reduce((sum, group) => sum + group._count.id, 0);

    const right = own
      .filter((group) => group.isCorrect)
      .reduce((sum, group) => sum + group._count.id, 0);

    const { chapters, more } = pickChapters(subject.chapters);

    return {
      answers: total > 0 ? { right, total } : null,
      chapters,
      // Done includes tested-out lessons, which are also named separately.
      lessonsDone: subject.lessonsDone + subject.lessonsKnown,
      lessonsTestedOut: subject.lessonsKnown,
      lessonsTotal: subject.lessonsTotal,
      moreChapters: more,
      name: subject.name,
      nextDate: subject.nextDate,
      openMistakes: mistakes
        .filter((group) => group.skillId && ids.has(group.skillId))
        .reduce((sum, group) => sum + group._count.id, 0),
      topics: subject.topics.length,
      topicsStudied: subject.topicsStudied,
    };
  });

  return { status: "found", subjects, what };
}

import "server-only";
import { type SubjectScopeContext } from "@zoonk/ai/tasks/lessons/question-context";
import { type SyllabusSubject } from "../../view-models/syllabus/syllabus-contract";

/**
 * The buddy's view of a subject of the learner's goal, as its page shows it: its topics in the
 * notice's words with their status, its chapters with their progress and next day, and how much
 * of it the learner studied, skipped because they knew it, and its size, from their own lessons.
 */
export function buildSubjectContextSnapshot({
  language,
  syllabusSubject,
}: {
  language: string;
  syllabusSubject: SyllabusSubject;
}): SubjectScopeContext {
  return {
    chapters: syllabusSubject.chapters.map((chapter) => ({
      lessonsDone: chapter.lessonsDone,
      lessonsTotal: chapter.lessonsTotal,
      nextDate: chapter.nextDate,
      state: chapter.state,
      title: chapter.title,
    })),
    language,
    scope: { kind: "subject" },
    subject: {
      lessonsDone: syllabusSubject.lessonsDone,
      lessonsKnown: syllabusSubject.lessonsKnown,
      lessonsTotal: syllabusSubject.lessonsTotal,
      name: syllabusSubject.name,
      nextDate: syllabusSubject.nextDate,
      notPlannedReason: syllabusSubject.notPlannedReason,
      questions: syllabusSubject.questions,
      source: syllabusSubject.source,
    },
    topics: syllabusSubject.topics.map((topic) => ({
      name: topic.name,
      nextDate: topic.nextDate,
      notPlannedReason: topic.notPlannedReason,
      status: topic.status,
    })),
    version: 1,
  };
}

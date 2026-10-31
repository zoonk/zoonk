import "server-only";
import { type SubjectScopeContext } from "@zoonk/ai/tasks/lessons/question-context";
import { type SyllabusSubject } from "../../view-models/syllabus/syllabus-contract";

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

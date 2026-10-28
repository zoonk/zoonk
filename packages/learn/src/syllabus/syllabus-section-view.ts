import {
  type SyllabusSubject,
  type SyllabusTopic,
  type SyllabusView,
} from "@zoonk/core/view-models/syllabus/contract";

export type SyllabusSectionSubject = Omit<SyllabusSubject, "chapters" | "topics"> & {
  topics: Omit<SyllabusTopic, "chapters">[];
};

export type SyllabusSectionView = Omit<SyllabusView, "subjects"> & {
  subjects: SyllabusSectionSubject[];
};

/**
 * Drops the chapters, which for a big exam (ENEM's run to ~60 KB) would ride in the page and every
 * prefetch of it.
 */
export function toSyllabusSection(syllabus: SyllabusView): SyllabusSectionView {
  return {
    ...syllabus,
    subjects: syllabus.subjects.map(({ chapters: _chapters, topics, ...subject }) => ({
      ...subject,
      topics: topics.map(({ chapters: _topicChapters, ...topic }) => topic),
    })),
  };
}

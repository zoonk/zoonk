import {
  type SyllabusSubject,
  type SyllabusTopic,
  type SyllabusView,
} from "@zoonk/core/view-models/syllabus/contract";

/** A subject as a list of subjects draws it: its numbers and topics, without its chapters. */
export type SyllabusSectionSubject = Omit<SyllabusSubject, "chapters" | "topics"> & {
  topics: Omit<SyllabusTopic, "chapters">[];
};

/**
 * What a list of a syllabus's subjects draws (the Plan's subjects, onboarding's coverage): every
 * subject's row, without the chapters that only the subject's own page lists.
 */
export type SyllabusSectionView = Omit<SyllabusView, "subjects"> & {
  subjects: SyllabusSectionSubject[];
};

/**
 * The syllabus without its chapters, for a page that lists only its subjects: a big exam's
 * chapters (ENEM's run to ~60 KB) would otherwise ride in the page and in every prefetch of it.
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

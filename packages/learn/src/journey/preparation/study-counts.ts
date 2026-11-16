import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";

type Count = { known: number; studied: number; total: number };

/** What the learner studied, then what they already knew, each of the same whole. */
export type StudyCount = {
  done: number;
  kind: "known" | "studied";
  total: number;
  unit: "lessons" | "topics";
};

/**
 * The topics an exam's Plan counts (its subjects' footer and each subject's page), so its
 * preparation counts the same ones. Null when the plan doesn't say which lessons teach them.
 */
export function getPlanTopics(
  syllabus: Pick<SyllabusView, "topicCount" | "topicsMapped"> & {
    subjects: readonly Pick<SyllabusView["subjects"][number], "topicsKnown" | "topicsStudied">[];
  },
): Count | null {
  if (!syllabus.topicsMapped || syllabus.topicCount === 0) {
    return null;
  }

  return {
    known: syllabus.subjects.reduce((sum, subject) => sum + (subject.topicsKnown ?? 0), 0),
    studied: syllabus.subjects.reduce((sum, subject) => sum + (subject.topicsStudied ?? 0), 0),
    total: syllabus.topicCount,
  };
}

function split({ known, studied, total }: Count, unit: StudyCount["unit"]): StudyCount[] {
  return [
    { done: studied, kind: "studied", total, unit },
    ...(known > 0 ? [{ done: known, kind: "known" as const, total, unit }] : []),
  ];
}

/**
 * The counts under a progress number: a goal's lessons, an exam's own topics, or else the topics its
 * preparation measured. A count never mixes what was studied with what the learner already knew.
 */
export function getStudyCounts({
  coverage,
  lessons,
  topics,
}: {
  coverage: { studiedSkills: number; totalSkills: number };
  lessons?: SyllabusView["lessons"] | null;
  topics?: Count | null;
}): StudyCount[] {
  if (lessons) {
    return split(
      { known: lessons.known, studied: lessons.done - lessons.known, total: lessons.total },
      "lessons",
    );
  }

  if (topics) {
    return split(topics, "topics");
  }

  return split(
    { known: 0, studied: coverage.studiedSkills, total: coverage.totalSkills },
    "topics",
  );
}

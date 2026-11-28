import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { getWrittenTasks } from "../../../exams/_utils/written-tasks";
import { type ExamPicks, toChosenStructure } from "../../../exams/choices/exam-choices";
import { loadExamPicks } from "../../../exams/choices/load-exam-choices";
import { getGroupLabel } from "../../../library/exams/group-label";
import { getPassMarks } from "../../../library/exams/pass-marks";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import {
  getPastQuestionsSource,
  getSubjectQuestions,
} from "../../../library/exams/subject-questions";
import { listPlanShares } from "../../../library/exams/subject-shares";
import { getTopicFrequencySource, listTopicLevels } from "../../../library/exams/topic-frequency";
import { getTopicHeadings } from "../../../library/exams/topic-groups";
import { readCourseWeights } from "../../../plans/planner/course-weights";
import { type SyllabusView } from "../syllabus-contract";
import { type NoticeSubject, type SyllabusInput } from "./syllabus-input";

function toCourseWeights(details: Goal["details"] | undefined): SyllabusView["courseWeights"] {
  const weights = readCourseWeights(details);

  return weights
    ? {
        course: weights.course,
        edition: weights.edition,
        institution: weights.institution,
        source: weights.source,
        subjects: weights.subjects,
      }
    : null;
}

/** Restricts the notice to the learner's picks; GET callers should share the already-read blueprint and picks. */
export async function loadNotice(
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind"> & Partial<Pick<Goal, "details" | "language">>,
  knownBlueprint?: ExamBlueprint | null | Promise<ExamBlueprint | null>,
  knownPicks?: ExamPicks,
): Promise<SyllabusInput["notice"]> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const [blueprint, picks] = await Promise.all([
    knownBlueprint === undefined
      ? prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : knownBlueprint,
    knownPicks ?? loadExamPicks(goal.id),
  ]);

  if (!blueprint) {
    return null;
  }

  const { edition, structure: read, topicFrequency } = readBlueprintContent(blueprint);
  const structure = toChosenStructure({ picks, structure: read });
  const levels = listTopicLevels({ structure, topicFrequency });
  const shares = listPlanShares(structure);

  const subjects: NoticeSubject[] = structure.subjects.map((subject, index) => ({
    frequencySource: getTopicFrequencySource({ structure, subject }),
    group: getGroupLabel({ structure, subject }),
    matrix: subject.matrix ?? [],
    name: subject.name,
    partOf: subject.partOf ?? null,
    questions: getSubjectQuestions({ structure, subject }),
    share: shares[index] ?? null,
    shortName: subject.shortName ?? null,
    topicFrequency: new Map(
      levels
        .filter((level) => level.subject === subject.name)
        .map((level) => [level.topic, level.level]),
    ),
    topicHeadings: getTopicHeadings(subject.topicGroups),
    topics: subject.topics,
    writtenTasks: getWrittenTasks({ structure, subject }),
  }));

  return {
    courseWeights: toCourseWeights(goal.details),
    fromMaterial: blueprint.ownerId !== null,
    passMarks: getPassMarks({ blueprint, goal, structure }),
    questionsSource: getPastQuestionsSource({ examName: blueprint.name, structure }),
    subjects,
    url: edition.noticeUrl,
  };
}

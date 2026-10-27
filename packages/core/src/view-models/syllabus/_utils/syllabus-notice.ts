import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { namesMatch } from "../../../exams/_utils/name-match";
import { toChosenStructure } from "../../../exams/choices/exam-choices";
import { loadExamChoices } from "../../../exams/choices/load-exam-choices";
import { getSubjectShare } from "../../../exams/map/exam-map";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { getPassMarks } from "../../../library/exams/pass-marks";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import {
  getPastQuestionsSource,
  getSubjectQuestions,
} from "../../../library/exams/subject-questions";
import { getTopicFrequencySource, listTopicLevels } from "../../../library/exams/topic-frequency";
import { getTopicHeadings } from "../../../library/exams/topic-groups";
import { readCourseWeights } from "../../../plans/planner/course-weights";
import { type SyllabusView } from "../syllabus-contract";
import { type NoticeSubject, type SyllabusInput } from "./syllabus-input";

/** The course weights a syllabus shows: those research found for the goal's course, if any. */
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

/**
 * What a subject's written test asks, from the exam's written sections named like it or its group
 * ("Discursive test (P3)": two discursive questions and a legal brief).
 */
function getWrittenTasks({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: ExamStructure["subjects"][number];
}): string[] {
  const names = [subject.name, subject.group].filter((name) => name !== undefined && name !== null);

  return (structure.mock?.sections ?? [])
    .filter(
      (section) =>
        section.kind === "written" && names.some((name) => namesMatch(section.name, name)),
    )
    .flatMap((section) => (section.tasks ?? []).map((task) => task.description));
}

/**
 * The exam's notice subjects (with their short names), when the goal is an exam with a blueprint:
 * the exam as the learner takes it, with only the options of its choices they picked, and its pass
 * marks in the goal's language when the reading translated them. A GET passes the blueprint it
 * already read; without one, it's read fresh.
 */
export async function loadNotice(
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind"> & Partial<Pick<Goal, "details" | "language">>,
  knownBlueprint?: ExamBlueprint | null | Promise<ExamBlueprint | null>,
): Promise<SyllabusInput["notice"]> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const [blueprint, choices] = await Promise.all([
    knownBlueprint === undefined
      ? prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : knownBlueprint,
    loadExamChoices(goal.id),
  ]);

  if (!blueprint) {
    return null;
  }

  const { edition, structure: read, topicFrequency } = readBlueprintContent(blueprint);
  const structure = toChosenStructure({ choices, structure: read });
  const levels = listTopicLevels({ structure, topicFrequency });

  const subjects: NoticeSubject[] = structure.subjects.map((subject) => ({
    frequencySource: getTopicFrequencySource({ structure, subject }),
    group: subject.group ?? null,
    matrix: subject.matrix ?? [],
    name: subject.name,
    partOf: subject.partOf ?? null,
    questions: getSubjectQuestions({ structure, subject }),
    share: getSubjectShare({ structure, subject }),
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
    questionsSource: getPastQuestionsSource(structure),
    subjects,
    url: edition.noticeUrl,
  };
}

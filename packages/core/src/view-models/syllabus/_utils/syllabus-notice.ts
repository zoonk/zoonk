import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { namesMatch } from "../../../exams/_utils/name-match";
import { type ExamChoice, toChosenStructure } from "../../../exams/choices/exam-choices";
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

/** Restricts notice choices to learner picks; GET callers should share the already-read blueprint and choices. */
export async function loadNotice(
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind"> & Partial<Pick<Goal, "details" | "language">>,
  knownBlueprint?: ExamBlueprint | null | Promise<ExamBlueprint | null>,
  knownChoices?: readonly ExamChoice[],
): Promise<SyllabusInput["notice"]> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const [blueprint, choices] = await Promise.all([
    knownBlueprint === undefined
      ? prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : knownBlueprint,
    knownChoices ?? loadExamChoices(goal.id),
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

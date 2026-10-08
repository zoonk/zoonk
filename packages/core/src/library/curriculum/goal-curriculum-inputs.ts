import "server-only";
import { type ExamOutline, formatExamOutline } from "@zoonk/ai/tasks/v2/curriculum/exam-outline";
import { type SkillGraphParams } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { type Course, type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { readCourseStart } from "../../goals/course-start-details";
import { getKnownSubjects } from "../../learner/placement/placement-contract";
import { isOwnMaterialTest } from "../../learner/placement/placement-material";
import { usesTools } from "../../plans/_utils/plan-tools";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { type OnboardingQuestion } from "../../view-models/onboarding/onboarding-contract";
import { getMissingQuestions } from "../../view-models/onboarding/onboarding-steps";
import {
  type ExamStructure,
  examStructureSchema,
  topicFrequencySchema,
} from "../exams/blueprint-contract";
import { isNoticeReadAgain } from "../exams/blueprint-reading";
import { type CandidateExam, toGoalCandidateExams } from "../exams/candidate-exams";
import { getSubjectQuestions } from "../exams/subject-questions";
import { listTopicLevels } from "../exams/topic-frequency";
import { loadGoalMaterial } from "../sources/goal-material";
import {
  type MaterialSource,
  formatMaterialOverview,
  toMaterialPages,
} from "../sources/material-pages";
import { type StartedCourse } from "./course-start-graph";
import { getLessonBudget } from "./lesson-budget";

type GraphPrompt = Omit<SkillGraphParams, "analytics" | "model" | "reasoning" | "useFallback">;

type Details = Record<string, unknown>;

/** Each reference is cut to this many characters: enough for a syllabus, bounded for the prompt. */
const MAX_REFERENCE_CHARACTERS = 30_000;
const MAX_REFERENCES = 3;

const PURPOSES = ["overview", "deep", "work", "careerChange", "refresh"] as const;
const OWN_LEVELS = ["none", "basic", "intermediate", "advanced"] as const;

/** Purposes with the scope university courses and official curricula are written for. */
const SYLLABUS_PURPOSES = new Set<(typeof PURPOSES)[number]>(["deep", "careerChange"]);

/**
 * Details the prompt already reads on their own lines, and onboarding's bookkeeping, so neither
 * is repeated in the context the model reads.
 */
const OMITTED_CONTEXT_FIELDS = new Set([
  "answered",
  "courseStart",
  "level",
  "onboardingId",
  "purpose",
]);

/** The onboarding answers that change the skill graph, which the curriculum waits for. */
const CURRICULUM_QUESTIONS = new Set<OnboardingQuestion>(["followUps", "level", "purpose", "role"]);

export type GoalCurriculumInputs = {
  goal: Pick<
    Goal,
    | "examBlueprintId"
    | "id"
    | "kind"
    | "language"
    | "prompt"
    | "targetLanguage"
    | "title"
    | "userId"
  >;
  graphPrompt: GraphPrompt;
  /** The exam its shared outlines are written for (see `toGoalCandidateExams`). */
  exams: CandidateExam[];
  /**
   * The goal's exam blueprint as the skill graph reads it (`graphPrompt.examBlueprint`), titled
   * for the coverage check: an exam's plan is built before research reads a new notice, then
   * checked against it once it's in. Null when the goal has no blueprint.
   */
  blueprintReference: { text: string; title: string } | null;
  /**
   * Research reads the notice of the goal's shared blueprint again (see `isNoticeReadAgain`), so
   * the graph waits for that reading instead of being built from the older one.
   */
  readsNoticeAgain: boolean;
  /**
   * The goal's sources as references for the coverage check: its exam notice, a law's text or a
   * product's docs, the syllabi research found for a big learn goal, or the learner's uploads.
   * Empty when it has none.
   */
  references: { text: string; title: string }[];
  /**
   * The goal is built from the learner's own material (class slides, notes): its curriculum is a
   * private course that follows the material, and its lessons cite their pages.
   */
  hasMaterial: boolean;
  /** A plan already built from a skill graph: the goal's curriculum exists and nothing is redone. */
  hasPlanGraph: boolean;
  /**
   * The goal practices with tools of its own (see `usesTools`): false for an exam answered on
   * paper or on screen, whose courses teach its skills in chapters without tools.
   */
  usesTools: boolean;
  /**
   * The learner is still answering onboarding questions that change the skill graph (purpose,
   * role, level, follow-ups), so the curriculum waits for them. Only goals typed in onboarding.
   */
  awaitingAnswers: boolean;
  isGuest: boolean;
  /**
   * The exam subjects the learner said they know well: placement writes no questions on their
   * basics, which it takes as known.
   */
  knownSubjects: string[];
  /**
   * A test from the learner's own material (a private blueprint): placement asks every topic of
   * it, so every skill gets placement questions (see `isOwnMaterialTest`).
   */
  ownMaterialTest: boolean;
  /**
   * The Library course the learner started the goal from, when its plan couldn't come from the
   * course's outline yet (nobody outlined it): the goal's curriculum is written into that course.
   * Null for goals typed or started any other way.
   */
  startedCourse: StartedCourse | null;
};

/** The allowed value the learner's answer names, or undefined for anything else. */
function readChoice<T extends string>({
  allowed,
  value,
}: {
  allowed: readonly T[];
  value: unknown;
}) {
  return allowed.find((choice) => choice === value);
}

/**
 * How much of the material the graph reads: a short handout whole, or the index of a long deck
 * (see `formatMaterialOverview`).
 */
const MAX_MATERIAL_OVERVIEW = 12_000;

/**
 * What the learner said beyond the goal, and their material (whole when it's short, else one line
 * per page), so a goal built from it covers what it teaches, in its order.
 */
function toContext({
  details,
  material,
}: {
  details: Record<string, unknown>;
  material: MaterialSource[];
}): string | undefined {
  const rest = Object.entries(details).filter(([key]) => !OMITTED_CONTEXT_FIELDS.has(key));
  const said = rest.length > 0 ? JSON.stringify(Object.fromEntries(rest)) : null;

  const index = formatMaterialOverview({
    maxCharacters: MAX_MATERIAL_OVERVIEW,
    pages: toMaterialPages(material),
  });

  const parts = [said, index && `The learner's own material, page by page:\n${index}`];
  const context = parts.filter(Boolean).join("\n\n");

  return context || undefined;
}

/** What the notice says about how the exam is answered and scored, which skills prepare for too. */
function toExamNotes(structure: ExamStructure | undefined): string[] {
  if (!structure) {
    return [];
  }

  const scoring = structure.mock?.scoring.description;

  return [
    ...structure.formats.map((format) => `Format: ${format.description}`),
    scoring ? `Scoring: ${scoring}` : "",
    ...structure.rules.map((rule) => `Rule: ${rule.text}`),
  ].filter((note) => note.trim().length > 0);
}

/**
 * The exam's notice as the curriculum reads it: each subject with its group, its share of the
 * score and every topic of its syllabus, what the notice says about format and scoring, and how
 * often the board asks each topic in past papers (read with the notice, or looked up).
 */
function toExamOutline(
  blueprint: Pick<ExamBlueprint, "name" | "structure" | "topicFrequency">,
): ExamOutline {
  const structure = examStructureSchema.safeParse(blueprint.structure).data;
  const frequency = topicFrequencySchema.safeParse(blueprint.topicFrequency).data ?? [];

  const subjects = structure
    ? structure.subjects.map((subject) => ({
        group: subject.group ?? null,
        name: subject.name,
        questions: getSubjectQuestions({ structure, subject }),
        topics: subject.topics,
        weight: subject.weight,
      }))
    : [];

  // What past papers among the notice's documents say, then what the lookup of them found.
  const looked = structure ? listTopicLevels({ structure, topicFrequency: [] }) : [];

  return {
    name: blueprint.name,
    notes: toExamNotes(structure),
    subjects,
    topicFrequency: [...frequency, ...looked].map(({ level, subject, topic }) => ({
      level,
      subject,
      topic,
    })),
  };
}

/**
 * A test from the learner's own material days away (a class test on Friday) is taught in at most
 * the lessons its days hold (see `getLessonBudget`); null for any other goal.
 */
function toLessonBudget({
  goal,
  hasMaterial,
}: {
  goal: Pick<Goal, "kind" | "targetDate" | "timezone">;
  hasMaterial: boolean;
}): number | null {
  if (goal.kind !== "exam" || !hasMaterial) {
    return null;
  }

  return getLessonBudget({
    targetDate: goal.targetDate,
    today: getDateInTimeZone({ date: new Date(), timeZone: goal.timezone ?? "UTC" }),
  });
}

/** Goals typed in onboarding carry its id; other goals (plan links, API clients) are never asked. */
function getUnansweredQuestions(
  goal: Pick<Goal, "kind" | "targetDate">,
  details: Details,
): OnboardingQuestion[] {
  if (typeof details.onboardingId !== "string") {
    return [];
  }

  return getMissingQuestions({
    details,
    kind: goal.kind,
    targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
  });
}

function isAwaitingAnswers(goal: Pick<Goal, "kind" | "targetDate">, details: Details): boolean {
  return getUnansweredQuestions(goal, details).some((question) =>
    CURRICULUM_QUESTIONS.has(question),
  );
}

/**
 * Whether research should find reference syllabi for a goal: `awaitingPurpose` while onboarding
 * may still ask why the learner wants it, since only that answer decides.
 */
export type ReferenceSyllabusNeed = "awaitingPurpose" | "needed" | "notNeeded";

/**
 * A learn goal big enough to check its curriculum against university courses and official
 * curricula: the learner wants to go deep or change careers, the scope those syllabi are
 * written for. An overview, a refresh or a skill for work is planned from the goal alone, and
 * so is a goal whose purpose nobody asked (plan links, API clients).
 */
export function getReferenceSyllabusNeed(
  goal: Pick<Goal, "details" | "kind" | "targetDate">,
): ReferenceSyllabusNeed {
  if (goal.kind !== "learn") {
    return "notNeeded";
  }

  const details = isJsonObject(goal.details) ? goal.details : {};
  const purpose = readChoice({ allowed: PURPOSES, value: details.purpose });

  if (purpose) {
    return SYLLABUS_PURPOSES.has(purpose) ? "needed" : "notNeeded";
  }

  return getUnansweredQuestions(goal, details).includes("purpose")
    ? "awaitingPurpose"
    : "notNeeded";
}

async function loadReferences(goalId: string) {
  const sources = await prisma.learnerSource.findMany({
    orderBy: { createdAt: "asc" },
    select: { source: { select: { extractedText: true, title: true } } },
    take: MAX_REFERENCES,
    where: { goalId, source: { extractedText: { not: null } } },
  });

  return sources.flatMap(({ source }) =>
    source.extractedText
      ? [{ text: source.extractedText.slice(0, MAX_REFERENCE_CHARACTERS), title: source.title }]
      : [],
  );
}

/** The course a goal was started from, as its curriculum writes it; a private one is its owner's. */
function toStartedCourse({
  course,
  details,
}: {
  course: Pick<Course, "id" | "title" | "userId" | "visibility"> | null;
  details: Details;
}): StartedCourse | null {
  if (!course || !readCourseStart(details)) {
    return null;
  }

  const ownerId = course.visibility === "private" ? course.userId : null;
  return { id: course.id, ownerId, title: course.title };
}

/**
 * What writing a goal's curriculum reads: the goal as the learner typed it and as onboarding
 * understood it, its exam blueprint, the sources research or the learner linked to it (reference
 * syllabi for the coverage check), whether the learner is a guest, and whether a plan was already
 * built. Null when the goal no longer exists or is an explain question.
 *
 * This is a workflow bridge: the goal id comes from the public boundary that created the goal.
 */
export async function loadGoalCurriculumInputs(
  goalId: string,
): Promise<GoalCurriculumInputs | null> {
  const goal = await prisma.goal.findUnique({
    include: {
      examBlueprint: true,
      plan: { select: { graph: true } },
      primaryCourse: { select: { id: true, title: true, userId: true, visibility: true } },
      user: { select: { isAnonymous: true } },
    },
    where: { id: goalId },
  });

  if (!goal || goal.kind === "explain") {
    return null;
  }

  const details = isJsonObject(goal.details) ? goal.details : {};

  const [references, material] = await Promise.all([
    loadReferences(goalId),
    loadGoalMaterial(goalId),
  ]);

  const outline = goal.examBlueprint ? toExamOutline(goal.examBlueprint) : undefined;

  const blueprint =
    goal.examBlueprint && outline
      ? { text: formatExamOutline(outline), title: goal.examBlueprint.name }
      : null;

  return {
    awaitingAnswers: isAwaitingAnswers(goal, details),
    blueprintReference: blueprint,
    exams: toGoalCandidateExams({ blueprint: goal.examBlueprint, kind: goal.kind }),
    goal: {
      examBlueprintId: goal.examBlueprintId,
      id: goal.id,
      kind: goal.kind,
      language: goal.language,
      prompt: goal.prompt,
      targetLanguage: goal.targetLanguage,
      title: goal.title,
      userId: goal.userId,
    },
    graphPrompt: {
      context: toContext({ details, material }),
      examBlueprint: outline,
      goal: goal.prompt,
      goalKind: goal.kind,
      language: goal.language,
      lessonBudget: toLessonBudget({ goal, hasMaterial: material.length > 0 }),
      ownLevel: readChoice({ allowed: OWN_LEVELS, value: details.level }),
      purpose: readChoice({ allowed: PURPOSES, value: details.purpose }),
      targetLanguage: goal.targetLanguage ?? undefined,
    },
    hasMaterial: material.length > 0,
    hasPlanGraph: parsePlanGraph(goal.plan?.graph).skills.length > 0,
    isGuest: goal.user.isAnonymous,
    knownSubjects: getKnownSubjects(goal),
    ownMaterialTest: isOwnMaterialTest(goal.examBlueprint),
    readsNoticeAgain: Boolean(
      goal.examBlueprint &&
      !goal.examBlueprint.ownerId &&
      isNoticeReadAgain({ blueprint: goal.examBlueprint, now: new Date() }),
    ),
    references,
    startedCourse: toStartedCourse({ course: goal.primaryCourse, details }),
    usesTools: usesTools({ examStructure: goal.examBlueprint?.structure ?? null, kind: goal.kind }),
  };
}

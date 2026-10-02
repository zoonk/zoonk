import "server-only";
import { type SkillGraphParams } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { type Course, type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { readCourseStart } from "../../goals/course-start-details";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { type OnboardingQuestion } from "../../view-models/onboarding/onboarding-contract";
import { getMissingQuestions } from "../../view-models/onboarding/onboarding-steps";
import { examStructureSchema, topicFrequencySchema } from "../exams/blueprint-contract";
import { loadGoalMaterial } from "../sources/goal-material";
import {
  type MaterialSource,
  formatMaterialIndex,
  toMaterialPages,
} from "../sources/material-pages";
import { type StartedCourse } from "./course-start-graph";

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
  /**
   * The goal's exam blueprint as the skill graph reads it (`graphPrompt.examBlueprint`), titled
   * for the coverage check: an exam's plan is built before research reads a new notice, then
   * checked against it once it's in. Null when the goal has no blueprint.
   */
  blueprintReference: { text: string; title: string } | null;
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
   * The learner is still answering onboarding questions that change the skill graph (purpose,
   * role, level, follow-ups), so the curriculum waits for them. Only goals typed in onboarding.
   */
  awaitingAnswers: boolean;
  isGuest: boolean;
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

/** How much of the material's page index the graph reads: enough for a long deck or handout. */
const MAX_MATERIAL_INDEX = 12_000;

/**
 * What the learner said beyond the goal, and an index of their material (one line per page), so
 * a goal built from it covers what it teaches, in its order.
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
  const index = formatMaterialIndex(toMaterialPages(material)).slice(0, MAX_MATERIAL_INDEX);

  const parts = [said, index && `The learner's own material, page by page:\n${index}`];
  const context = parts.filter(Boolean).join("\n\n");

  return context || undefined;
}

/**
 * The exam's areas as the skill graph weighs them: each subject with its share of the score and
 * its topics, and how often the board asks each topic in past papers.
 */
function formatExamBlueprint(
  blueprint: Pick<ExamBlueprint, "name" | "structure" | "topicFrequency">,
) {
  const structure = examStructureSchema.safeParse(blueprint.structure).data;
  const frequency = topicFrequencySchema.safeParse(blueprint.topicFrequency).data ?? [];

  const subjects = (structure?.subjects ?? []).map((subject) => {
    const weight = subject.weight === null ? "" : ` (weight ${Math.round(subject.weight * 100)}%)`;
    return `- ${subject.name}${weight}: ${subject.topics.join("; ")}`;
  });

  const topics = frequency.map((topic) => `- ${topic.subject} / ${topic.topic}: ${topic.level}`);

  return [
    `EXAM: ${blueprint.name}`,
    subjects.length > 0 ? `SUBJECTS:\n${subjects.join("\n")}` : null,
    topics.length > 0 ? `TOPIC_FREQUENCY:\n${topics.join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
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

  const blueprint = goal.examBlueprint
    ? { text: formatExamBlueprint(goal.examBlueprint), title: goal.examBlueprint.name }
    : null;

  return {
    awaitingAnswers: isAwaitingAnswers(goal, details),
    blueprintReference: blueprint,
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
      examBlueprint: blueprint?.text,
      goal: goal.prompt,
      goalKind: goal.kind,
      language: goal.language,
      ownLevel: readChoice({ allowed: OWN_LEVELS, value: details.level }),
      purpose: readChoice({ allowed: PURPOSES, value: details.purpose }),
      targetLanguage: goal.targetLanguage ?? undefined,
    },
    hasMaterial: material.length > 0,
    hasPlanGraph: parsePlanGraph(goal.plan?.graph).skills.length > 0,
    isGuest: goal.user.isAnonymous,
    references,
    startedCourse: toStartedCourse({ course: goal.primaryCourse, details }),
  };
}

import "server-only";
import { type ExamOutline, formatExamOutline } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { type SkillGraphParams } from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { type Course, type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { listChoiceGroups } from "../../exams/choices/choice-groups";
import { readCourseStart } from "../../goals/course-start-details";
import { getKnownSubjects, getOwnLevel } from "../../learner/placement/placement-contract";
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
import { type CandidateExam, toGoalCandidateExams } from "../exams/candidate-exams";
import { getSubjectQuestions } from "../exams/subject-questions";
import { listTopicLevels } from "../exams/topic-frequency";
import { GOAL_PRODUCT_SELECT, type GoalProduct, toGoalProduct } from "../products/goal-product";
import { loadGoalMaterial } from "../sources/goal-material";
import {
  type MaterialSource,
  formatMaterialOverview,
  toMaterialPages,
} from "../sources/material-pages";
import { type StartedCourse } from "./course-start-graph";
import { listGoalReferences } from "./goal-references";
import { getLessonBudget } from "./lesson-budget";
import { toExamIdentity, toSharedContext } from "./shared-graph-prompt";

type GraphPrompt = Omit<SkillGraphParams, "analytics" | "model" | "reasoning" | "useFallback">;

type Details = Record<string, unknown>;

const PURPOSES = ["overview", "deep", "work", "careerChange", "refresh"] as const;

const SYLLABUS_PURPOSES = new Set<(typeof PURPOSES)[number]>(["deep", "careerChange"]);

const OMITTED_CONTEXT_FIELDS = new Set([
  "answered",
  "courseStart",
  "level",
  "onboardingId",
  "onboardingPlace",
  "purpose",
]);

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
  sharedContext: string | undefined;
  examIdentity: string | null;
  exams: CandidateExam[];
  blueprintReference: { text: string; title: string } | null;
  references: { text: string; title: string }[];
  hasMaterial: boolean;
  hasPlanGraph: boolean;
  usesTools: boolean;
  unansweredQuestions: OnboardingQuestion[];
  isGuest: boolean;
  knownSubjects: string[];
  ownMaterialTest: boolean;
  /** Research decided whether the goal is about a product, linked or not; the graph waits for it. */
  productChecked: boolean;
  product: GoalProduct | null;
  startedCourse: StartedCourse | null;
};

function readChoice<T extends string>({
  allowed,
  value,
}: {
  allowed: readonly T[];
  value: unknown;
}) {
  return allowed.find((choice) => choice === value);
}

const MAX_MATERIAL_OVERVIEW = 12_000;

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

export function toExamOutline(
  blueprint: Pick<ExamBlueprint, "name" | "structure" | "topicFrequency">,
): ExamOutline {
  const structure = examStructureSchema.safeParse(blueprint.structure).data;
  const frequency = topicFrequencySchema.safeParse(blueprint.topicFrequency).data ?? [];

  const choices = structure ? listChoiceGroups(structure) : [];

  const takenOf = (name?: string | null) => {
    const choice = choices.find((item) => item.name === name);
    return choice ? { choiceTake: choice.take } : {};
  };

  const subjects = structure
    ? structure.subjects.map((subject) => ({
        choiceGroup: subject.choiceGroup ?? null,
        ...takenOf(subject.choiceGroup),
        group: subject.group ?? null,
        name: subject.name,
        questions: getSubjectQuestions({ structure, subject }),
        shortName: subject.shortName ?? null,
        topics: subject.topics,
        weight: subject.weight,
      }))
    : [];

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

export type ReferenceSyllabusNeed = "awaitingPurpose" | "needed" | "notNeeded";

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

/** Internal workflow bridge: the public boundary must already have authorized the goal. */
export async function loadGoalCurriculumInputs(
  goalId: string,
): Promise<GoalCurriculumInputs | null> {
  const goal = await prisma.goal.findUnique({
    include: {
      examBlueprint: true,
      plan: { select: { graph: true } },
      primaryCourse: { select: { id: true, title: true, userId: true, visibility: true } },
      ...GOAL_PRODUCT_SELECT,
      user: { select: { isAnonymous: true } },
    },
    where: { id: goalId },
  });

  if (!goal || goal.kind === "explain") {
    return null;
  }

  const details = isJsonObject(goal.details) ? goal.details : {};

  const [references, material] = await Promise.all([
    listGoalReferences({ goalId, productId: goal.productId }),
    loadGoalMaterial(goalId),
  ]);

  const outline = goal.examBlueprint ? toExamOutline(goal.examBlueprint) : undefined;

  const blueprint =
    goal.examBlueprint && outline
      ? { text: formatExamOutline(outline), title: goal.examBlueprint.name }
      : null;

  const exams = toGoalCandidateExams({ blueprint: goal.examBlueprint, kind: goal.kind });
  const product = toGoalProduct(goal);

  return {
    blueprintReference: blueprint,
    examIdentity: goal.kind === "exam" ? toExamIdentity({ details, exams }) : null,
    exams,
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
      ownLevel: getOwnLevel({ goal }) ?? undefined,
      product: product && {
        brand: product.brand,
        courseTitle: product.courseTitle,
        name: product.name,
      },
      purpose: readChoice({ allowed: PURPOSES, value: details.purpose }),
      targetLanguage: goal.targetLanguage ?? undefined,
    },
    hasMaterial: material.length > 0,
    hasPlanGraph: parsePlanGraph(goal.plan?.graph).skills.length > 0,
    isGuest: goal.user.isAnonymous,
    knownSubjects: getKnownSubjects(goal),
    ownMaterialTest: isOwnMaterialTest(goal.examBlueprint),
    product,
    productChecked: goal.productCheckedAt !== null,
    references,
    sharedContext: toSharedContext(details),
    startedCourse: toStartedCourse({ course: goal.primaryCourse, details }),
    unansweredQuestions: getUnansweredQuestions(goal, details),
    usesTools: usesTools({ examStructure: goal.examBlueprint?.structure ?? null, kind: goal.kind }),
  };
}

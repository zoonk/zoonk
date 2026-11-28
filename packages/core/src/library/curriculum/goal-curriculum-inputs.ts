import "server-only";
import { formatExamOutline } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { type SkillGraphParams } from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { type Course, type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getGoalContentCountry } from "../../goals/_utils/goal-content-country";
import { unpinnedCourseSourceId } from "../../goals/course-start-details";
import { loadGoalLevelDetails } from "../../language/levels/current-language-level";
import { getKnownSubjects, getOwnLevel } from "../../learner/placement/placement-contract";
import { isOwnMaterialTest } from "../../learner/placement/placement-material";
import { usesTools } from "../../plans/_utils/plan-tools";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { type OnboardingQuestion } from "../../view-models/onboarding/onboarding-contract";
import {
  getFollowUpQuestions,
  getMissingQuestions,
} from "../../view-models/onboarding/onboarding-steps";
import { getContentCountryScope } from "../content-country";
import { type CandidateExam, toGoalCandidateExams } from "../exams/candidate-exams";
import { GOAL_PRODUCT_SELECT, type GoalProduct, toGoalProduct } from "../products/goal-product";
import { loadGoalMaterial } from "../sources/goal-material";
import {
  type MaterialSource,
  formatMaterialOverview,
  toMaterialPages,
} from "../sources/material-pages";
import { type StartedCourse, toStartedCourse } from "./course-start-graph";
import { toExamOutline } from "./exam-curriculum-outline";
import { getGoalCourseLevel } from "./goal-course-level";
import { listGoalReferences } from "./goal-references";
import { getLessonBudget } from "./lesson-budget";
import { toExamIdentity, toSharedContext } from "./shared-graph-prompt";

type GraphPrompt = Omit<SkillGraphParams, "analytics" | "model" | "reasoning" | "useFallback">;

type Details = Record<string, unknown>;

const PURPOSES = ["overview", "deep", "work", "careerChange", "refresh"] as const;

const SYLLABUS_PURPOSES = new Set<(typeof PURPOSES)[number]>(["deep", "careerChange"]);

const OMITTED_CONTEXT_FIELDS = new Set([
  "answered",
  "courseLevel",
  "courseStart",
  "level",
  "onboardingId",
  "onboardingPlace",
  "purpose",
]);

export type GoalCurriculumInputs = {
  goal: Pick<
    Goal,
    | "contentCountry"
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
  /** Its reading asked the learner follow-up questions, which only a private graph reads. */
  asksFollowUps: boolean;
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
  sourceCourse?: (StartedCourse & Pick<Course, "format">) | null;
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

function toSourceCourse(
  course: Pick<Course, "format" | "id" | "title" | "userId"> | null,
  country: string | null,
) {
  return (
    course && {
      country,
      format: course.format,
      id: course.id,
      ownerId: course.userId,
      title: course.title,
    }
  );
}

/** Internal workflow bridge: the public boundary must already have authorized the goal. */
export async function loadGoalCurriculumInputs(
  goalId: string,
): Promise<GoalCurriculumInputs | null> {
  const goal = await prisma.goal.findUnique({
    include: {
      examBlueprint: true,
      plan: { select: { graph: true } },
      primaryCourse: {
        select: { country: true, id: true, title: true, userId: true, visibility: true },
      },
      sourceCourse: { select: { format: true, id: true, title: true, userId: true } },
      ...GOAL_PRODUCT_SELECT,
      user: { select: { isAnonymous: true } },
    },
    where: { id: goalId },
  });

  if (!goal || goal.kind === "explain") {
    return null;
  }

  const [references, material, details] = await Promise.all([
    listGoalReferences({ goalId, productId: goal.productId }),
    loadGoalMaterial(goalId),
    loadGoalLevelDetails(goal),
  ]);

  const outline = goal.examBlueprint ? toExamOutline(goal.examBlueprint) : undefined;

  const blueprint =
    goal.examBlueprint && outline
      ? { text: formatExamOutline(outline), title: goal.examBlueprint.name }
      : null;

  const exams = toGoalCandidateExams({ blueprint: goal.examBlueprint, kind: goal.kind });
  const product = toGoalProduct(goal);
  const source = unpinnedCourseSourceId(goal) ? goal.sourceCourse : null;

  const country = getContentCountryScope({
    country:
      goal.kind === "exam"
        ? (goal.examBlueprint?.country ?? goal.contentCountry)
        : getGoalContentCountry({ existingCountry: goal.primaryCourse?.country, goal }),
    language: goal.language,
  });

  return {
    asksFollowUps: getFollowUpQuestions(details).length > 0,
    blueprintReference: blueprint,
    examIdentity: goal.kind === "exam" ? toExamIdentity({ details, exams }) : null,
    exams,
    goal: {
      contentCountry: country,
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
      courseLevel: getGoalCourseLevel({ details, kind: goal.kind }),
      examBlueprint: outline,
      goal: goal.prompt,
      goalKind: goal.kind,
      language: goal.language,
      lessonBudget: toLessonBudget({ goal, hasMaterial: material.length > 0 }),
      ownLevel: getOwnLevel({ goal: { details } }) ?? undefined,
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
    sourceCourse: toSourceCourse(source, country),
    startedCourse: toStartedCourse({
      country,
      course: source ? null : goal.primaryCourse,
      details,
      kind: goal.kind,
    }),
    unansweredQuestions: getUnansweredQuestions(goal, details),
    usesTools: usesTools({ examStructure: goal.examBlueprint?.structure ?? null, kind: goal.kind }),
  };
}

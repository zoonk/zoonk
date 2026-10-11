import "server-only";
import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { getAllowance } from "../../entitlements/get-allowance";
import { getExamDocument } from "../../exams/exam-document";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getOutlinedUntil } from "../../plans/_utils/stand-in-lessons";
import { getExamPrepAccess } from "../../sessions/_utils/exam-access";
import { resolveViewGoal } from "../_utils/resolve-view-goal";
import { loadTodayLearnBlocks } from "../_utils/today-lesson-order";
import { buildSyllabus } from "./_utils/build-syllabus";
import { loadSyllabusInput } from "./_utils/load-syllabus";
import { type SyllabusView } from "./syllabus-contract";

/**
 * Where a known topic comes back to be confirmed: practice, or the quick review on a free exam
 * plan past its first week, whose practice is Plus (see `loadReviewsAndClaims`).
 */
async function getKnownTopicsReturn({
  goal,
  timeZone,
  today,
}: {
  goal: Pick<Goal, "createdAt" | "kind">;
  timeZone: string;
  today: Date;
}): Promise<SyllabusView["knownTopicsReturn"]> {
  if (goal.kind !== "exam") {
    return "practice";
  }

  const allowance = await getAllowance();

  const access = getExamPrepAccess({
    examPrep: allowance?.examPrep ?? null,
    goal,
    timeZone,
    today,
  });

  return access.trialEnded ? "reviews" : "practice";
}

export type SyllabusViewResult =
  | { status: "noGoal" | "notFound" | "unauthorized" }
  | { status: "ready"; syllabus: SyllabusView };

/**
 * The structure of a goal (the active goal by default), so the learner can see all of it and trust
 * it's complete: an exam's notice subjects and topics in its own words, each with progress and when
 * the plan studies it next, or the plan's modules with their chapters. A goal without a plan yet
 * isn't found. The API serves the same view as `GET /v1/goals/{goalId}/syllabus`.
 */
export async function getSyllabusView(
  input: { goalId?: string } = {},
): Promise<SyllabusViewResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;

  if (goal.examBlueprintId) {
    cacheTag(getExamBlueprintCacheTag(goal.examBlueprintId));
  }

  const [syllabusInput, todayBlocks] = await Promise.all([
    loadSyllabusInput(goal),
    loadTodayLearnBlocks(goal),
  ]);

  if (!syllabusInput) {
    return { status: "notFound" };
  }

  const timeZone = getAnswerTimeZone({ goal });
  const today = getDateInTimeZone({ date: new Date(), timeZone });

  return {
    status: "ready",
    syllabus: {
      examDocument: getExamDocument(goal),
      goal: { id: goal.id, kind: goal.kind, title: goal.title },
      knownTopicsReturn: await getKnownTopicsReturn({ goal, timeZone, today }),
      ...buildSyllabus({ ...syllabusInput, outlinedUntil: getOutlinedUntil(today), todayBlocks }),
    },
  };
}

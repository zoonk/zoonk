import "server-only";
import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { getAllowance } from "../../entitlements/get-allowance";
import { getExamDocument } from "../../exams/exam-document";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getOutlinedUntil } from "../../plans/_utils/stand-in-lessons";
import { getGoalPreparation } from "../../preparation/get-goal-preparation";
import { getExamPrepAccess } from "../../sessions/_utils/exam-access";
import { resolveViewGoal } from "../_utils/resolve-view-goal";
import { loadTodayLearnBlocks } from "../_utils/today-lesson-order";
import { buildSyllabus } from "./_utils/build-syllabus";
import { readSyllabusInput } from "./_utils/read-syllabus-input";
import { type SyllabusView } from "./syllabus-contract";

/** Free exam reviews must confirm known topics after mixed practice becomes Plus-only. */
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

async function loadSections(goal: Pick<Goal, "id" | "kind">) {
  if (goal.kind !== "exam") {
    return null;
  }

  const result = await getGoalPreparation(goal.id);
  return result.status === "ready" ? result.preparation.sections : null;
}

export type SyllabusViewResult =
  | { status: "noGoal" | "notFound" | "unauthorized" }
  | { status: "ready"; syllabus: SyllabusView };

/** Requires goal ownership; returns not-found without a plan and shares the public syllabus contract. */
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

  const [syllabusInput, todayBlocks, sections] = await Promise.all([
    readSyllabusInput(goal.userId, goal.id),
    loadTodayLearnBlocks(goal),
    loadSections(goal),
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
      ...buildSyllabus({
        ...syllabusInput,
        outlinedUntil: getOutlinedUntil(today),
        sections,
        todayBlocks,
      }),
    },
  };
}

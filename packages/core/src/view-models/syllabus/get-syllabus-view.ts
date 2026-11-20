import "server-only";
import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { getExamDocument } from "../../exams/exam-document";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readTodayLearnBlocks } from "../../learner/facts/today-learn-blocks";
import { readSharedExams } from "../../plans/_utils/shared-exams";
import { getOutlinedUntil } from "../../plans/_utils/stand-in-lessons";
import { getGoalPreparation } from "../../preparation/get-goal-preparation";
import { resolveViewGoal } from "../_utils/resolve-view-goal";
import { buildSyllabus } from "./_utils/build-syllabus";
import { readSyllabusInput } from "./_utils/read-syllabus-input";
import { type SyllabusView } from "./syllabus-contract";

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

  const [syllabusInput, todayBlocks, sections, shared] = await Promise.all([
    readSyllabusInput(goal.userId, goal.id),
    readTodayLearnBlocks(goal.userId, goal.id),
    loadSections(goal),
    readSharedExams(goal),
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
      goal: { displayName: goal.displayName, id: goal.id, kind: goal.kind, title: goal.title },
      knownTopicsReturn: "practice",
      sharedExams: shared.exams,
      ...buildSyllabus({
        ...syllabusInput,
        outlinedUntil: getOutlinedUntil(today),
        sections,
        shared,
        todayBlocks,
      }),
    },
  };
}

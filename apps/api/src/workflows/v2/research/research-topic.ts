import { type ResearchTopic } from "@zoonk/ai/tasks/v2/research/plan";
import { type ReferenceSyllabusNeed } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { sleep } from "workflow";
import { repeatUntil } from "../_shared/repeat-until";
import { detectChangingFactsStep } from "./steps/detect-changing-facts-step";
import { type ResearchGoal, loadResearchGoalStep } from "./steps/load-research-goal-step";

/**
 * Onboarding asks why the learner wants the goal among its first questions, so research waits
 * for that answer the way the curriculum does: usually seconds, at most three minutes.
 */
const PURPOSE_POLL = "3s";
const MAX_PURPOSE_POLLS = 60;

async function waitForPurpose(goal: ResearchGoal): Promise<ReferenceSyllabusNeed> {
  if (goal.referenceSyllabi !== "awaitingPurpose") {
    return goal.referenceSyllabi;
  }

  const latest = await repeatUntil({
    done: (loaded) => loaded?.referenceSyllabi !== "awaitingPurpose",
    run: () => loadResearchGoalStep(goal.id),
    times: MAX_PURPOSE_POLLS,
    wait: () => sleep(PURPOSE_POLL),
  });

  return latest?.referenceSyllabi ?? "notNeeded";
}

/**
 * What a goal's research reads: the dated facts it depends on (an exam's notice, a law, a
 * product's docs), or, for a big learn goal whose subject doesn't change, reference syllabi to
 * check its curriculum against. A goal built from the learner's own material follows that
 * material instead of a university's syllabus.
 */
export async function detectResearchTopic(goal: ResearchGoal): Promise<ResearchTopic | "none"> {
  const topic = await detectChangingFactsStep({ goal });

  if (topic !== "none" || goal.kind !== "learn" || goal.uploadIds.length > 0) {
    return topic;
  }

  const need = await waitForPurpose(goal);

  return need === "needed" ? "syllabus" : "none";
}

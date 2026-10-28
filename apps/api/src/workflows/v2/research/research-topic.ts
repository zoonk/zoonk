import { type ResearchTopic } from "@zoonk/ai/tasks/v2/research/plan";
import { type ReferenceSyllabusNeed } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { sleep } from "workflow";
import { repeatUntil } from "../_shared/repeat-until";
import { detectChangingFactsStep } from "./steps/detect-changing-facts-step";
import { type ResearchGoal, loadResearchGoalStep } from "./steps/load-research-goal-step";

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

export async function detectResearchTopic(goal: ResearchGoal): Promise<ResearchTopic | "none"> {
  const topic = await detectChangingFactsStep({ goal });

  if (topic !== "none" || goal.kind !== "learn" || goal.uploadIds.length > 0) {
    return topic;
  }

  const need = await waitForPurpose(goal);

  return need === "needed" ? "syllabus" : "none";
}

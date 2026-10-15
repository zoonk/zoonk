import "server-only";
import { type MissionDocument } from "../missions/catalog";
import { loadDayMissionFacts } from "../missions/day-facts";
import { pickMissions } from "../missions/pick-missions";
import { type PlannedBlock, type SessionBuildInput, buildSessionBlocks } from "../session-builder";
import { loadDayPlan } from "./day-plan";
import { loadSessionBuildInput } from "./load-build-inputs";
import { type SelectedDayPlan } from "./selected-day-plan";
import { type SessionDayContext } from "./session-placement";

export type PlannedStudyDay = {
  blocks: PlannedBlock[];
  input: SessionBuildInput;
  missions: MissionDocument;
  plan: Awaited<ReturnType<typeof loadDayPlan>>;
  plannedMinutes: number;
};

/** Both preview and persistence select blocks from the same plan value; this never replans. */
export async function planStudyDay(
  context: SessionDayContext & { selection: SelectedDayPlan },
): Promise<PlannedStudyDay> {
  const plan = await loadDayPlan(context);
  const input = await loadSessionBuildInput({ ...context, dayPlan: plan });
  const { blocks, plannedMinutes } = buildSessionBlocks(input);
  const facts = await loadDayMissionFacts({ ...context, blocks, dayPlan: plan, plannedMinutes });

  return {
    blocks,
    input,
    missions: { picks: pickMissions(facts), version: 1 },
    plan,
    plannedMinutes,
  };
}

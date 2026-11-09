import "server-only";
import { type UsageTotals } from "../../entitlements/_utils/usage-counts";
import { type PracticeMistake } from "../../mistakes/mistake-practice-eligibility";
import { type loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
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

/** The day's blocks without its missions, for reads that show only what the day holds. */
export async function planDayBlocks(
  context: SessionDayContext & { selection: SelectedDayPlan },
): Promise<Omit<PlannedStudyDay, "missions">> {
  const plan = await loadDayPlan(context);
  const input = await loadSessionBuildInput({ ...context, dayPlan: plan });
  return { ...buildSessionBlocks(input), input, plan };
}

/** Uses the supplied selected plan; preview and persistence must never re-plan independently. */
export async function planStudyDay(
  context: SessionDayContext & {
    readMistakes?: () => Promise<PracticeMistake[]>;
    readPreparation?: () => ReturnType<typeof loadPreparationInputs>;
    readUsage?: () => Promise<UsageTotals>;
    selection: SelectedDayPlan;
  },
): Promise<PlannedStudyDay> {
  const day = await planDayBlocks(context);

  const facts = await loadDayMissionFacts({
    ...context,
    blocks: day.blocks,
    dayPlan: day.plan,
    plannedMinutes: day.plannedMinutes,
  });

  return { ...day, missions: { picks: pickMissions(facts), version: 1 } };
}

export function toUnstartedBlocks(blocks: readonly PlannedBlock[]) {
  return blocks.map((block, position) => ({ ...block, position, status: "pending" as const }));
}

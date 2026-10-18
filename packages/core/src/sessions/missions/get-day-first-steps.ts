import "server-only";
import { type StudySessionRow } from "../_utils/study-session-access";
import { readBlockPayload } from "../block-payload";
import { getStoredBlockWait } from "../block-wait";
import { type Mission } from "../missions";
import { loadDayMissionFacts } from "./day-facts";
import { type FirstSteps } from "./first-steps";
import { getMissionBlocks } from "./mission-blocks";

/** The private tour uses history; daily mission status and targets come from the saved day's picks. */
export async function getDayFirstSteps({
  session,
  timeZone,
  missions,
}: {
  session: StudySessionRow;
  timeZone: string;
  missions: readonly Mission[];
}): Promise<FirstSteps | null> {
  if (!session.goal) {
    return null;
  }

  const facts = await loadDayMissionFacts({
    blocks: session.blocks
      .filter((block) => block.status !== "skipped")
      .map((block) => ({
        ...block,
        estimatedMinutes: block.estimatedMinutes ?? 0,
        payload: readBlockPayload(block),
      })),
    goal: session.goal,
    localDate: session.localDate,
    plannedMinutes: session.plannedMinutes,
    timeZone,
    userId: session.userId,
  });

  const firstSteps = facts.firstSteps;

  if (!firstSteps) {
    return null;
  }

  return {
    ...firstSteps,
    steps: firstSteps.steps.map((step) => {
      if (step.status === "done") {
        return step;
      }

      const mission = missions.find(
        (pick) =>
          pick.kind === step.kind ||
          (step.kind === "somethingNew" && pick.kind === "finishChapter"),
      );

      if (mission) {
        return {
          ...step,
          opens: mission.opens ?? step.opens,
          status: mission.status === "done" ? ("done" as const) : ("today" as const),
          ...(mission.status !== "done" &&
            mission.waitReason && { waitReason: mission.waitReason }),
        };
      }

      const candidate = facts.candidates.find(
        (pick) =>
          pick.kind === step.kind ||
          (step.kind === "somethingNew" && pick.kind === "finishChapter"),
      );

      const block = candidate
        ? getMissionBlocks({ blocks: session.blocks, pick: candidate }).find(
            (pick) => pick.status !== "completed",
          )
        : null;

      if (!block) {
        return step;
      }

      // A block the day orders after others says so, as the mission for it would.
      const waitReason = getStoredBlockWait({ block, blocks: session.blocks });

      return {
        ...step,
        opens: { blockId: block.id, kind: "block" as const },
        ...(waitReason && { waitReason }),
      };
    }),
  };
}

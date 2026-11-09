import "server-only";
import {
  type Goal,
  type Plan,
  type PlanItem,
  type StudySessionBlock,
  type TransactionClient,
} from "@zoonk/db";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
import { findLastCheckpointResults } from "../../checkpoints/_utils/checkpoint-results";
import { getPassMark } from "../../checkpoints/checkpoint-rules";
import { readSelectedItemFacts } from "../../plans/_utils/selected-item-contract";
import { readBlockPayload } from "../block-payload";
import { type PlannedCheckpoint, type PlannedLesson } from "../session-builder";
import { isMockOnlyDay } from "./day-mock";
import { findPlannedReview } from "./day-review";
import { fundLeadingChallenges, getLeadingChallenges, listDayStretch } from "./day-stretch";
import { type StudySessionRow } from "./study-session-access";

type ChallengeRefillInput = {
  blocks: readonly StudySessionBlock[];
  leaving: readonly StudySessionBlock[];
  plan: Pick<Plan, "settings"> & { items: PlanItem[] };
  session: StudySessionRow & { goal: Goal };
  trialEnded: boolean;
};

function getRefillCheckpoints({
  blocks,
  leaving,
  plan,
  session,
  trialEnded,
}: ChallengeRefillInput): PlannedCheckpoint[] {
  const held = new Set(
    blocks.flatMap((block) => {
      const payload = readBlockPayload(block);
      return [payload.planItemId, payload.planItemKey].filter((id): id is string => id !== null);
    }),
  );

  const trimmed = new Set(
    leaving.flatMap((block) => {
      const payload = readBlockPayload(block);

      return block.kind === "checkpoint"
        ? [payload.planItemId, payload.planItemKey].filter((id): id is string => id !== null)
        : [];
    }),
  );

  const blockedDay =
    isMockOnlyDay({
      goal: session.goal,
      hasMock: blocks.some((block) => readBlockPayload(block).checkpoint?.mock),
      items: plan.items,
      planSettings: plan.settings,
      today: session.localDate,
    }) || Boolean(findPlannedReview({ items: plan.items, today: session.localDate }));

  return trialEnded || blockedDay
    ? []
    : plan.items.flatMap((item): PlannedCheckpoint[] => {
        const facts = readSelectedItemFacts(item.facts)?.boss;

        if (
          item.kind !== "boss" ||
          item.status !== "todo" ||
          held.has(item.id) ||
          trimmed.has(item.id) ||
          !facts ||
          facts.waiting ||
          facts.kind === "recording" ||
          facts.testedSkillIds.length === 0
        ) {
          return [];
        }

        const lastPhase = Math.max(...plan.items.map((entry) => entry.phase));

        return [
          {
            itemIds: [],
            kind: item.phase === lastPhase ? "finalBoss" : "boss",
            minutes: facts.minutes,
            mock: false,
            passMark: getPassMark(facts.questions ?? 0),
            phase: item.phase,
            planItemId: item.id,
            rematch: false,
            skillIds: facts.testedSkillIds,
            timeLimitMinutes: null,
            title: item.titleSnapshot,
          },
        ];
      });
}

export async function fitRefillStretch({
  blocks,
  leaving,
  plan,
  session,
  trialEnded,
  lessons,
  budget,
  phaseChallengesRequired,
  tx,
}: ChallengeRefillInput & {
  lessons: PlannedLesson[];
  budget: number;
  phaseChallengesRequired?: boolean;
  tx: TransactionClient;
}) {
  const checkpoints = getRefillCheckpoints({ blocks, leaving, plan, session, trialEnded });

  const held = new Set(
    blocks.flatMap((block) => {
      const payload = readBlockPayload(block);
      return [payload.planItemId, payload.planItemKey].filter((id): id is string => id !== null);
    }),
  );

  const potential = listDayStretch({
    ahead: held,
    budget,
    checkpoints,
    items: plan.items,
    leading: fundLeadingChallenges({
      budget,
      checkpoints: getLeadingChallenges({ checkpoints, items: plan.items }).filter(
        (checkpoint) => checkpoint.minutes <= budget,
      ),
    }),
    lessons,
  });

  const hasCall =
    potential.some((entry) => entry.kind === "challenge") && session.goal.kind === "language";

  const required =
    phaseChallengesRequired ??
    (hasCall
      ? Boolean(
          await findActiveSubscriptionForUser({
            client: tx,
            now: new Date(),
            userId: session.userId,
          }),
        )
      : undefined);

  const ids =
    required !== false && potential.some((entry) => entry.kind === "challenge")
      ? checkpoints.flatMap((checkpoint) => checkpoint.planItemId ?? [])
      : [];

  const results = await findLastCheckpointResults({
    client: tx,
    planItemIds: ids,
    userId: session.userId,
  });

  const available = (required === false ? [] : checkpoints)
    .filter((checkpoint) => {
      const result = results.get(checkpoint.planItemId ?? "");
      return !result || result.localDate.getTime() !== session.localDate.getTime();
    })
    .map((checkpoint) => ({ ...checkpoint, rematch: results.has(checkpoint.planItemId ?? "") }));

  const stretch = listDayStretch({
    ahead: held,
    budget,
    checkpoints: available,
    items: plan.items,
    leading: fundLeadingChallenges({
      budget,
      checkpoints: getLeadingChallenges({ checkpoints: available, items: plan.items }).filter(
        (checkpoint) => checkpoint.minutes <= budget,
      ),
    }),
    lessons,
  });

  return { checkpoints, phaseChallengesRequired: required, stretch };
}

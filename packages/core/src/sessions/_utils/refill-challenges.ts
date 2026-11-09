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
import { canHoldPhaseChallenges } from "./phase-challenge-day";
import { type StudySessionRow } from "./study-session-access";

type ChallengeRefillInput = {
  blocks: readonly StudySessionBlock[];
  leaving: readonly StudySessionBlock[];
  plan: Pick<Plan, "settings"> & { items: PlanItem[] };
  session: StudySessionRow & { goal: Goal };
  trialEnded: boolean;
};

function getRefillCheckpoints({
  held,
  mockOnlyDay,
  leaving,
  plan,
  session,
  trialEnded,
}: Omit<ChallengeRefillInput, "blocks"> & {
  held: ReadonlySet<string>;
  mockOnlyDay: boolean;
}): PlannedCheckpoint[] {
  const trimmed = new Set(
    leaving.flatMap((block) => {
      const payload = readBlockPayload(block);

      return block.kind === "checkpoint"
        ? [payload.planItemId, payload.planItemKey].filter((id): id is string => id !== null)
        : [];
    }),
  );

  return canHoldPhaseChallenges({
    mockOnlyDay,
    reviewDay: Boolean(findPlannedReview({ items: plan.items, today: session.localDate })),
    trialEnded,
  })
    ? plan.items.flatMap((item): PlannedCheckpoint[] => {
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
      })
    : [];
}

export async function fitRefillStretch({
  blocks,
  leaving,
  plan,
  session,
  trialEnded,
  lessons,
  budget,
  tx,
}: ChallengeRefillInput & { lessons: PlannedLesson[]; budget: number; tx: TransactionClient }) {
  const held = new Set(
    blocks.flatMap((block) => {
      const payload = readBlockPayload(block);
      return [payload.planItemId, payload.planItemKey].filter((id): id is string => id !== null);
    }),
  );

  const checkpoints = getRefillCheckpoints({
    held,
    leaving,
    mockOnlyDay: isMockOnlyDay({
      goal: session.goal,
      hasMock: blocks.some((block) => readBlockPayload(block).checkpoint?.mock),
      items: plan.items,
      planSettings: plan.settings,
      today: session.localDate,
    }),
    plan,
    session,
    trialEnded,
  });

  const ahead = new Set(
    blocks.flatMap((block) => {
      const payload = readBlockPayload(block);

      return payload.extra
        ? []
        : [payload.planItemId, payload.planItemKey].filter((id): id is string => id !== null);
    }),
  );

  const potential = listDayStretch({
    ahead,
    budget,
    checkpoints,
    items: plan.items,
    leading: fundLeadingChallenges({
      budget,
      checkpoints: getLeadingChallenges({ checkpoints, items: plan.items }),
      overflow: false,
    }),
    lessons,
  });

  if (!potential.some((entry) => entry.kind === "challenge")) {
    return { checkpoints, stretch: potential };
  }

  const required =
    session.goal.kind === "language"
      ? Boolean(
          await findActiveSubscriptionForUser({
            client: tx,
            now: new Date(),
            userId: session.userId,
          }),
        )
      : true;

  const ids = required ? checkpoints.flatMap((checkpoint) => checkpoint.planItemId ?? []) : [];

  const results = await findLastCheckpointResults({
    client: tx,
    planItemIds: ids,
    userId: session.userId,
  });

  const available = (required ? checkpoints : [])
    .filter((checkpoint) => {
      const result = results.get(checkpoint.planItemId ?? "");
      return !result || result.localDate.getTime() !== session.localDate.getTime();
    })
    .map((checkpoint) => ({ ...checkpoint, rematch: results.has(checkpoint.planItemId ?? "") }));

  const stretch = listDayStretch({
    ahead,
    budget,
    checkpoints: available,
    items: plan.items,
    leading: fundLeadingChallenges({
      budget,
      checkpoints: getLeadingChallenges({ checkpoints: available, items: plan.items }),
      overflow: false,
    }),
    lessons,
  });

  return { checkpoints, stretch };
}

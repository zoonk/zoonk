import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { getLanguageCountry } from "@zoonk/utils/countries";
import { isJsonObject } from "@zoonk/utils/json";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { getAnsweredQuestions } from "../../view-models/onboarding/onboarding-steps";
import { type GoalUpdateInput, onlyCoreDetails, withoutCoreDetails } from "../goal-contract";
import { hasCountryReading, isCountryGoal } from "./goal-content-country";
import { ActiveGoalLimitError, findActiveGoalLimit, moveActiveGoalAway } from "./goal-status";

/** A learner's details replace theirs whole but keep what only core writes. */
function mergeDetails({
  current,
  details,
}: {
  current: Goal;
  details: GoalUpdateInput["details"];
}) {
  if (details === undefined) {
    return details;
  }

  const stored = isJsonObject(current.details) ? current.details : {};
  return { ...withoutCoreDetails(details), ...onlyCoreDetails(stored) };
}

export function goalMetadata({ current, input }: { current: Goal; input: GoalUpdateInput }) {
  const details = mergeDetails({ current, details: input.details });
  const resolvedDetails = details ?? (isJsonObject(current.details) ? current.details : {});

  const countryDetails =
    input.contentCountry === undefined
      ? details
      : {
          ...resolvedDetails,
          answered: [...new Set([...getAnsweredQuestions(resolvedDetails), "contentCountry"])],
          contentCountrySource: "picked",
          ...(hasCountryReading(current) ? {} : { countryDependent: true }),
        };

  return {
    contentCountry: input.contentCountry,
    details: countryDetails,
    displayName: input.displayName,
    status: input.status,
    studyTime: input.studyTime,
    targetRegion: input.targetRegion,
    timezone: input.timeZone,
    title: input.title,
  };
}

function changesMetadata(goal: Goal, input: GoalUpdateInput): boolean {
  return Object.entries(goalMetadata({ current: goal, input })).some(
    ([key, value]) => value !== undefined && !isDeepStrictEqual(value, Reflect.get(goal, key)),
  );
}

/**
 * The caller's learner write marks plan inputs changed when the status, details or time zone
 * change. Activating a goal throws `ActiveGoalLimitError` when the active goals are at the plan's
 * limit, which rolls that write back; the count runs under the write's learner lock, which goal
 * creation's claim takes too.
 */
export async function saveMetadataInTransaction(
  tx: TransactionClient,
  { goal, input, userId }: { goal: Goal; input: GoalUpdateInput; userId: string },
) {
  const current = await tx.goal.findFirstOrThrow({ where: { id: goal.id, userId } });

  const limit =
    input.status === "active" && current.status !== "active"
      ? await findActiveGoalLimit({ db: tx, goalId: current.id, userId })
      : null;

  if (limit) {
    throw new ActiveGoalLimitError(limit);
  }

  const changed = changesMetadata(current, input);

  const updated = changed
    ? await tx.goal.update({ data: goalMetadata({ current, input }), where: { id: current.id } })
    : current;

  const ownCountry = getLanguageCountry(current.language);

  const changedCountry =
    input.contentCountry !== undefined &&
    (input.contentCountry ?? ownCountry) !== (current.contentCountry ?? ownCountry);

  const firstCountryChoice = input.contentCountry !== undefined && !hasCountryReading(current);

  if ((changedCountry || firstCountryChoice) && isCountryGoal(updated)) {
    await oweFollowUps({
      db: tx,
      followUps: [{ input: { goalId: current.id }, kind: "rebuildGoalCurriculum" }],
      userId,
    });
  }

  const moved = input.status
    ? await moveActiveGoalAway({ goalId: goal.id, status: input.status, tx, userId })
    : 0;

  if (!changed && moved === 0) {
    return { changed: false, completed: false, goal: current };
  }

  return {
    changed: true,
    completed: current.status !== "completed" && updated.status === "completed",
    goal: updated,
  };
}

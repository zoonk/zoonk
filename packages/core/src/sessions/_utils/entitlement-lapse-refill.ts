import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
import {
  arePhaseChallengesRequired,
  shouldRefillAfterEntitlementLapse,
  withoutLockedPhaseChallenges,
} from "../../checkpoints/_utils/phase-challenge-access";
import { readBlockPayload } from "../block-payload";
import { type DayBlockInput } from "./day-block-view";
import { withSessionAppendLock } from "./extra-blocks";
import { hasSameGoalInputs } from "./goal-input-snapshot";
import { hasSameBlocks, planRestOfDay } from "./refresh-day-session";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

type EntitlementRefill = {
  basis: { id: string; inputVersion: number; version: number };
  blocks: DayBlockInput[];
  lessons: Awaited<ReturnType<typeof planRestOfDay>>;
};

class RefillInputsChangedError extends Error {
  override name = "RefillInputsChangedError";
}

/** Shared by preview and Open. Only an entitlement lapse may refill a shown day. */
export async function planEntitlementLapseRefill({
  goal,
  phaseChallengesRequired,
  session,
  timeZone,
}: {
  goal: Goal;
  phaseChallengesRequired?: boolean;
  session: Omit<StudySessionRow, "goal">;
  timeZone: string;
}): Promise<EntitlementRefill | null> {
  if (goal.kind !== "language" || session.status === "completed") {
    return null;
  }

  if (
    !shouldRefillAfterEntitlementLapse({ blocks: session.blocks, phaseChallengesRequired: false })
  ) {
    return null;
  }

  const required =
    phaseChallengesRequired ??
    (await arePhaseChallengesRequired({ goalKind: goal.kind, userId: session.userId }));

  if (
    !shouldRefillAfterEntitlementLapse({
      blocks: session.blocks,
      phaseChallengesRequired: required,
    })
  ) {
    return null;
  }

  const kept = withoutLockedPhaseChallenges({
    blocks: session.blocks,
    phaseChallengesRequired: required,
  });

  const keptIds = new Set(kept.map((block) => block.id));

  const lockedIds = session.blocks
    .filter((block) => !keptIds.has(block.id))
    .map((block) => block.id);

  const replaced = new Set(
    session.blocks.flatMap((block) => readBlockPayload(block).entitlementReplacementFor),
  );

  if (lockedIds.every((id) => replaced.has(id))) {
    return null;
  }

  const basis = await prisma.plan.findUnique({
    select: { id: true, inputVersion: true, version: true },
    where: { goalId: goal.id },
  });

  if (!basis) {
    return null;
  }

  const planned = await planRestOfDay({
    day: { goal, session: { ...session, goal }, timeZone },
    kept,
  });

  const lessons = planned
    .filter((block) => block.kind === "learn")
    .map((block) => ({
      ...block,
      payload: { ...block.payload, entitlementReplacementFor: lockedIds },
    }));

  if (lessons.length === 0) {
    return null;
  }

  const firstPosition = Math.max(-1, ...session.blocks.map((block) => block.position)) + 1;

  return {
    basis,
    blocks: [
      ...kept,
      ...lessons.map((block, index) => ({
        ...block,
        brainPower: 0,
        position: firstPosition + index,
        status: "pending" as const,
      })),
    ],
    lessons,
  };
}

/** Only the learner's POST appends the previewed free work, once even when Opens race. */
export async function persistEntitlementLapseRefill({
  goal,
  session,
  timeZone,
}: {
  goal: Goal;
  session: StudySessionRow;
  timeZone: string;
}): Promise<StudySessionRow | null> {
  const refill = await planEntitlementLapseRefill({ goal, session, timeZone });

  if (!refill) {
    return session;
  }

  try {
    await withSessionAppendLock({
      plan: { id: refill.basis.id, write: true },
      run: async ({ session: locked, transaction }) => {
        if (
          locked.goal?.status !== "active" ||
          !hasSameGoalInputs({ current: locked.goal, planned: goal })
        ) {
          throw new RefillInputsChangedError();
        }

        if (
          locked.status === "completed" ||
          !hasSameBlocks({ locked: locked.blocks, read: session.blocks })
        ) {
          return false;
        }

        const current = await transaction.plan.findUnique({
          select: { inputVersion: true, version: true },
          where: { id: refill.basis.id },
        });

        if (
          !current ||
          current.version !== refill.basis.version ||
          current.inputVersion !== refill.basis.inputVersion + 1
        ) {
          throw new RefillInputsChangedError();
        }

        if (
          await findActiveSubscriptionForUser({
            client: transaction,
            now: new Date(),
            userId: session.userId,
          })
        ) {
          return false;
        }

        const position = Math.max(-1, ...locked.blocks.map((block) => block.position)) + 1;

        await transaction.studySessionBlock.createMany({
          data: refill.lessons.map((block, index) => ({
            ...block,
            position: position + index,
            sessionId: session.id,
          })),
        });

        await transaction.studySession.update({
          data: {
            plannedMinutes: [...locked.blocks, ...refill.lessons].reduce(
              (sum, block) => sum + (block.estimatedMinutes ?? 0),
              0,
            ),
          },
          where: { id: session.id },
        });

        return true;
      },
      session,
    });
  } catch (error) {
    if (error instanceof RefillInputsChangedError) {
      return null;
    }

    throw error;
  }

  return prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: session.id },
  });
}

import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { awardMilestones } from "../../milestones/award-milestones";
import { hasPracticeRunCorrection } from "../../mistakes/_utils/practice-runs";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { addSessionBrainPower } from "../_utils/session-ledger";
import { applySessionProgress } from "../_utils/session-progress";
import { type SessionSnapshot, readFullMealReward } from "../_utils/session-snapshot";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "../_utils/study-session-access";
import { BRAIN_POWER_BONUS } from "../brain-power";
import { type Mission, isFullMeal } from "../missions";
import { type BlockMissionResult, keepBlockMissionResult } from "./block-mission-result";
import {
  type MissionDocument,
  type MissionKind,
  type MissionPick,
  readMissionDocument,
} from "./catalog";
import { getDayMissions, hasDayMissionBonus } from "./get-day-missions";
import { isLinkedBlockMission, isLinkedCallMission } from "./linked-call-mission";

export type MissionCompletionSource = NonNullable<SessionSnapshot["fullMealSource"]>;

const ACTIVITY_MISSIONS: Readonly<Record<string, MissionKind>> = {
  buddyQuestion: "askBuddy",
  conversation: "call",
  mistakePractice: "fixMistake",
  patternDrill: "pattern",
  pronunciationRound: "pronunciation",
};

function isCompletedBy({ kind, source }: { kind: MissionKind; source: MissionCompletionSource }) {
  return ACTIVITY_MISSIONS[source.kind] === kind;
}

type MissionSettlement = {
  /** What the finished block did to the missions (kept by its first finish); null without one. */
  blockResult: BlockMissionResult | null;
  fullMealPaid: boolean;
  fullMealReward: ReturnType<typeof readFullMealReward>;
  missions: Mission[];
  newlyClaimed: MissionPick[];
  newlyDone: MissionPick[];
  session: StudySessionRow;
};

/** No changed mission or reward means the owning transaction must roll back its early marks. */
class MissionsUnchangedError extends Error {
  override name = "MissionsUnchangedError";
  readonly settlement: MissionSettlement;

  constructor(settlement: MissionSettlement) {
    super("The missions did not change");
    this.settlement = settlement;
  }
}

function readSettlement(outcome: SafeReturn<MissionSettlement>): MissionSettlement {
  if (outcome.error instanceof MissionsUnchangedError) {
    return outcome.error.settlement;
  }

  if (outcome.error) {
    throw outcome.error;
  }

  return outcome.data;
}

function getNewlyDone({
  document,
  missions,
}: {
  document: MissionDocument | null;
  missions: readonly Mission[];
}) {
  return (
    document?.picks.filter(
      (pick) =>
        (pick.done ?? 0) < pick.total &&
        missions.some((mission) => mission.kind === pick.kind && mission.status === "done"),
    ) ?? []
  );
}

async function getCompletingSource({
  session,
  source,
  through,
  timeZone,
  tx,
}: {
  session: StudySessionRow;
  source: MissionCompletionSource | undefined;
  through: Date;
  timeZone: string;
  tx: TransactionClient;
}) {
  if (source?.kind !== "mistakePractice") {
    return source;
  }

  const corrected = await hasPracticeRunCorrection({
    from: getStartOfLocalDay({ localDate: session.localDate, timeZone }),
    runId: source.id,
    through,
    tx,
    userId: session.userId,
  });

  return corrected ? source : undefined;
}

/** The once-only reward and its recoverable evidence share the mission's owning transaction. */
async function payFullMeal(
  tx: TransactionClient,
  {
    lock,
    session,
    source,
    userId,
  }: {
    lock: Awaited<ReturnType<typeof getCompletionEnergyContext>>;
    session: StudySessionRow;
    source: MissionCompletionSource | undefined;
    userId: string;
  },
) {
  const saved = session.startSnapshot;

  const snapshot =
    saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : {};

  const { brainPower: reward } = await applySessionProgress(tx, {
    completion: false,
    delta: {
      brainPower: BRAIN_POWER_BONUS.fullMeal,
      correctAnswers: 0,
      energyDelta: 0,
      incorrectAnswers: 0,
      seconds: 0,
    },
    lock,
    userId,
  });

  await tx.studySession.update({
    data: {
      fullMealAt: lock.completedAt,
      startSnapshot: {
        ...snapshot,
        fullMealReward: reward,
        ...(source && { fullMealSource: source }),
      },
    },
    where: { id: session.id },
  });

  await addSessionBrainPower(tx, {
    brainPower: BRAIN_POWER_BONUS.fullMeal,
    sessionId: session.id,
    userId,
  });

  return reward;
}

/** Progress and reward evidence commit together under the learner lock, once per local session day. */
export async function settleMissions({
  blockId,
  revalidation = "now",
  sessionId,
  timeZone,
  userId,
  source,
}: {
  /** The block whose finish this settles: it keeps what it did, so another finish says the same. */
  blockId?: string;
  revalidation?: "now" | "skip";
  sessionId: string;
  timeZone: string;
  userId: string;
  source?: MissionCompletionSource;
}) {
  const outcome = await safeAsync(() =>
    prisma.$transaction(async (tx): Promise<MissionSettlement> => {
      await markLearnerChanged(tx, { userId });

      const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });

      const session = await tx.studySession.findFirstOrThrow({
        include: STUDY_SESSION_INCLUDE,
        where: { id: sessionId, userId },
      });

      const missions = await getDayMissions({
        client: tx,
        session,
        through: lock.completedAt,
        timeZone,
      });

      const document = readMissionDocument(session.missions);

      const completingSource = await getCompletingSource({
        session,
        source,
        through: lock.completedAt,
        timeZone,
        tx,
      });

      const linkedCall =
        source?.kind === "conversation"
          ? await tx.languageConversation.findFirst({
              select: { endedAt: true, studyBlockId: true },
              where: { id: source.id, status: "completed", userId },
            })
          : null;

      // Only the session block a mock actually completed may credit its mission.
      const linkedMock =
        source?.kind === "mockExam"
          ? await tx.mockExam.findFirst({
              select: { blockId: true },
              where: { id: source.id, userId },
            })
          : null;

      const mockBlockId = linkedMock?.blockId ?? null;

      const newlyDone = getNewlyDone({ document, missions });

      // Settling another activity can mark a mission done without owning this activity's credit.
      const claimed =
        document?.picks.filter(
          (pick) =>
            completingSource !== undefined &&
            !pick.completedBy &&
            (isCompletedBy({ kind: pick.kind, source: completingSource }) ||
              isLinkedCallMission({ blocks: session.blocks, call: linkedCall, pick }) ||
              (mockBlockId !== null &&
                isLinkedBlockMission({ blockId: mockBlockId, blocks: session.blocks, pick }))) &&
            ((pick.done ?? 0) >= pick.total || newlyDone.includes(pick)),
        ) ?? [];

      if (document && (newlyDone.length > 0 || claimed.length > 0)) {
        await tx.studySession.update({
          data: {
            missions: {
              ...document,
              picks: document.picks.map((pick) => {
                const done = newlyDone.includes(pick) ? { done: pick.total } : {};

                return claimed.includes(pick)
                  ? { ...pick, ...done, completedBy: completingSource }
                  : { ...pick, ...done };
              }),
            },
          },
          where: { id: session.id },
        });
      }

      const fullMealDue =
        isFullMeal(missions) &&
        !(await hasDayMissionBonus({ client: tx, now: lock.completedAt, session, timeZone }));

      const settled = {
        blockResult: await keepBlockMissionResult(tx, {
          blockId,
          fullMealPaid: fullMealDue,
          newlyDone,
        }),
        missions,
        newlyClaimed: claimed,
        newlyDone,
        session,
      };

      if (!fullMealDue) {
        const result = {
          ...settled,
          fullMealPaid: false,
          fullMealReward: readFullMealReward(session.startSnapshot),
        };

        if (newlyDone.length === 0 && claimed.length === 0) {
          throw new MissionsUnchangedError(result);
        }

        return result;
      }

      const reward = await payFullMeal(tx, { lock, session, source: completingSource, userId });

      return { ...settled, fullMealPaid: true, fullMealReward: reward };
    }),
  );

  const settled = readSettlement(outcome);

  if (source && settled.newlyDone.length > 0) {
    after(() =>
      trackLearnerEvents({
        events: settled.newlyDone.map((pick) => ({
          name: "Mission Completed" as const,
          properties: { full_meal: isFullMeal(settled.missions), mission: pick.kind },
        })),
        goalId: settled.session.goalId,
        userId,
      }),
    );
  }

  if (
    revalidation === "now" &&
    (settled.newlyDone.length > 0 || settled.newlyClaimed.length > 0 || settled.fullMealPaid)
  ) {
    revalidateCacheTags([getUserProgressCacheTag(userId)]);
  }

  if (source && settled.fullMealReward) {
    await awardMilestones({ brainPower: settled.fullMealReward, userId });
  }

  return settled;
}

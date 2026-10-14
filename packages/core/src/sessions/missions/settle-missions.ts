import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { awardMilestones } from "../../milestones/award-milestones";
import { hasPracticeRunCorrection } from "../../mistakes/_utils/practice-runs";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { addSessionBrainPower } from "../_utils/session-ledger";
import { applySessionProgress } from "../_utils/session-progress";
import {
  type SessionSnapshot,
  readFullMealReward,
  readLegacyMissionCompletions,
} from "../_utils/session-snapshot";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "../_utils/study-session-access";
import { BRAIN_POWER_BONUS } from "../brain-power";
import { type Mission, isFullMeal } from "../missions";
import { type MissionDocument, type MissionKind, readMissionDocument } from "./catalog";
import { getDayMissions, hasDayMissionBonus } from "./get-day-missions";
import { isLinkedBlockMission, isLinkedCallMission } from "./linked-call-mission";

export type MissionCompletionSource = NonNullable<SessionSnapshot["fullMealSource"]>;

/** The mission each activity outside the day's blocks does: the only one it can take credit for. */
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

/** Old sessions retain dynamic mission selection; only the first completing activity is saved. */
async function settleLegacyMissions({
  missions,
  session,
  source,
  tx,
}: {
  missions: readonly Mission[];
  session: StudySessionRow;
  source: MissionCompletionSource | undefined;
  tx: TransactionClient;
}) {
  const saved = session.startSnapshot;

  const snapshot =
    saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : {};

  if (session.missions !== null || !source) {
    return { claimed: [], snapshot };
  }

  const completions = readLegacyMissionCompletions(saved);

  const claimed = missions.filter(
    (mission) =>
      mission.status === "done" &&
      isCompletedBy({ kind: mission.kind, source }) &&
      !completions.some((completion) => completion.kind === mission.kind),
  );

  if (claimed.length === 0) {
    return { claimed, snapshot };
  }

  const attributed = {
    ...snapshot,
    legacyMissionCompletions: [
      ...completions,
      ...claimed.map((mission) => ({ completedBy: source, kind: mission.kind })),
    ],
  };

  await tx.studySession.update({ data: { startSnapshot: attributed }, where: { id: session.id } });

  return { claimed, snapshot: attributed };
}

/** Progress and reward evidence commit together under the learner lock, once per local session day. */
export async function settleMissions({
  sessionId,
  timeZone,
  userId,
  source,
}: {
  sessionId: string;
  timeZone: string;
  userId: string;
  source?: MissionCompletionSource;
}) {
  const settled = await prisma.$transaction(async (tx) => {
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

    const { claimed: legacyClaimed, snapshot } = await settleLegacyMissions({
      missions,
      session,
      source: completingSource,
      tx,
    });

    const linkedCall =
      source?.kind === "conversation"
        ? await tx.languageConversation.findFirst({
            select: { endedAt: true, studyBlockId: true },
            where: { id: source.id, status: "completed", userId },
          })
        : null;

    // A mock settles as it finishes its own session block: only that block can give it credit.
    const linkedMock =
      source?.kind === "mockExam"
        ? await tx.mockExam.findFirst({
            select: { blockId: true },
            where: { id: source.id, userId },
          })
        : null;

    const mockBlockId = linkedMock?.blockId ?? null;

    const newlyDone = getNewlyDone({ document, missions });

    // The activity claims the done missions of its own kind that no activity claimed yet: another
    // activity settling first can mark them done, but never takes their credit.
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

    if (
      !isFullMeal(missions) ||
      (await hasDayMissionBonus({ client: tx, now: lock.completedAt, session, timeZone }))
    ) {
      return {
        fullMealPaid: false,
        fullMealReward: readFullMealReward(session.startSnapshot),
        legacyClaimed,
        missions,
        newlyDone,
        session,
      };
    }

    const reward = await applySessionProgress(tx, {
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
          ...(completingSource && { fullMealSource: completingSource }),
        },
      },
      where: { id: session.id },
    });

    await addSessionBrainPower(tx, {
      brainPower: BRAIN_POWER_BONUS.fullMeal,
      sessionId: session.id,
      userId,
    });

    return {
      fullMealPaid: true,
      fullMealReward: reward,
      legacyClaimed,
      missions,
      newlyDone,
      session,
    };
  });

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

  if (settled.newlyDone.length > 0 || settled.legacyClaimed.length > 0 || settled.fullMealPaid) {
    revalidateCacheTags([getUserProgressCacheTag(userId)]);
  }

  if (source && settled.fullMealReward) {
    await awardMilestones({ brainPower: settled.fullMealReward, userId });
  }

  return settled;
}

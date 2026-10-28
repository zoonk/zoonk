import "server-only";
import { type Milestone, prisma } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { io } from "next/cache";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { loadCeremony } from "../milestones/load-ceremony";
import { measureSessionState } from "./_utils/capture-snapshot";
import { isCurrentSession } from "./_utils/current-session";
import { withExtraStudyCheck } from "./_utils/extra-blocks";
import {
  type SkillMove,
  loadBuddyMeal,
  loadComesBack,
  loadSealedCapsules,
  loadSkillNames,
  loadTomorrow,
} from "./_utils/load-summary-parts";
import { getNetScore, getNetScoredItemIds } from "./_utils/net-score";
import { loadSessionAnswers } from "./_utils/session-answers";
import { sumSessionSeconds } from "./_utils/session-ledger";
import {
  type SessionState,
  getMovedSkills,
  readSessionEnd,
  readSessionSnapshot,
} from "./_utils/session-snapshot";
import { toStudySessionView } from "./_utils/session-view";
import { type StudySessionRow, findOwnedStudySession } from "./_utils/study-session-access";
import { scoreAnswers } from "./brain-power";
import { type StudySessionTimeZoneInput } from "./contract";
import { type ExtraTime } from "./extra-time";
import { getDailyTimeLimitStatus } from "./get-daily-time-limit";
import { type Mission } from "./missions";
import { getDayMissions, hasDayMissionBonus } from "./missions/get-day-missions";

const SECONDS_PER_MINUTE = 60;

type Change<TValue> = { after: TValue; before: TValue };

type StudySessionSummary = {
  accuracy: number | null;
  /** Only new or due material builds this streak. */
  bestStreak: number;
  belt: (Change<BeltLevelResult> & { colorChanged: boolean; stripesGained: number }) | null;
  brainPower: number;
  capsulesSealed: { lessonId: string; opensOn: Date | null; title: string | null }[];
  ceremony: Milestone | null;
  comesBack: { date: Date; skills: number }[];
  correct: number;
  energy: Change<number> | null;
  extraTime: ExtraTime;
  /** False after Stop for today while unfinished blocks remain. */
  finished: boolean;
  fullMeal: boolean;
  /** Actual recorded time, consistent with learner stats. */
  minutes: number;
  missions: Mission[];
  mistakesSaved: number;
  /** Right minus wrong for net-scored questions only; null when none exist. */
  netScore: number | null;
  newCards: { description: string; name: string; skillId: string }[];
  buddyAte: { fixes: number; newIdeas: number; reviews: number };
  preparation: Change<number | null>;
  /** Share of plan lessons studied or known; null for exam goals. */
  progress: Change<number | null>;
  questions: number;
  sessionId: string;
  skillsMoved: SkillMove[];
  status: "active" | "completed" | "planned";
  tomorrow: { title: string } | null;
  topHyperdrive: number;
};

export type StudySessionSummaryResult =
  | { status: "ready"; summary: StudySessionSummary }
  | { status: "notFound" }
  | { status: "unauthorized" };

function getBeltChange(before: number, after: number): StudySessionSummary["belt"] {
  const from = calculateBeltLevel(before);
  const to = calculateBeltLevel(after);
  const colorChanged = from.color !== to.color;

  return {
    after: to,
    before: from,
    colorChanged,
    stripesGained: colorChanged ? to.level : Math.max(0, to.level - from.level),
  };
}

/** Completed summaries use saved end state; stopped sessions use current state. */
async function measureSummaryState({
  session,
  timeZone,
  userId,
}: {
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}): Promise<SessionState> {
  const end = session.status === "completed" ? readSessionEnd(session.endSnapshot) : null;

  return end ?? measureSessionState({ goalId: session.goalId, now: new Date(), timeZone, userId });
}

/** Requires ownership; completed sessions replay saved end state while stopped sessions reflect current progress. */
export async function getStudySessionSummary({
  input,
  sessionId,
}: {
  input: StudySessionTimeZoneInput;
  sessionId: string;
}): Promise<StudySessionSummaryResult> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  // A stopped session's current state must be measured at request time, outside prerendering.
  await io();

  const { session, userId } = owned;
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: input.timeZone });
  const snapshot = readSessionSnapshot(session.startSnapshot);

  const [answers, after, missions, mistakesSaved, dailyLimit, seconds, fullMealEarned] =
    await Promise.all([
      loadSessionAnswers({ blocks: session.blocks, sessionId, userId }),
      measureSummaryState({ session, timeZone, userId }),
      getDayMissions({
        session,
        timeZone,
        ...(isCurrentSession({ now: new Date(), session, timeZone }) && { through: new Date() }),
      }),
      prisma.mistake.count({ where: { attempt: { studySessionId: sessionId }, userId } }),
      getDailyTimeLimitStatus(),
      sumSessionSeconds(prisma, { sessionId, userId }),
      hasDayMissionBonus({
        session,
        timeZone,
        ...(isCurrentSession({ now: new Date(), session, timeZone }) && { now: new Date() }),
      }),
    ]);

  const moves = snapshot ? getMovedSkills({ current: after.skillStates, snapshot }) : [];
  const newSkillIds = moves.filter((move) => move.from === "new").map((move) => move.skillId);
  const names = await loadSkillNames(moves.map((move) => move.skillId));
  const nameOf = (skillId: string) => names.find((skill) => skill.id === skillId);

  const view = toStudySessionView({
    answers,
    current: isCurrentSession({ now: new Date(), session, timeZone }),
    dailyLimit,
    dayMinutes: session.plannedMinutes,
    examAccess: { includesMockExams: true, trialEnded: false },
    fullMealEarned,
    missions,
    session,
    week: { days: [], nextStudyDate: null, time: { studiedMinutes: 0, targetMinutes: 0 } },
  });

  const netScoredItemIds = getNetScoredItemIds(session.blocks);

  const [comesBack, capsulesSealed, buddyAte, ceremony, tomorrow, extraTime, netScore] =
    await Promise.all([
      loadComesBack({ answers, session, timeZone, userId }),
      loadSealedCapsules({ session, timeZone, userId }),
      loadBuddyMeal({ answers, newIdeas: newSkillIds.length, session, userId }),
      loadCeremony(userId),
      loadTomorrow({ session }),
      withExtraStudyCheck({ extraTime: view.extraTime, session, userId }),
      netScoredItemIds.length > 0
        ? getNetScore({ itemIds: netScoredItemIds, sessionId, userId })
        : null,
    ]);

  const correct = answers.filter((answer) => answer.isCorrect).length;
  const scored = scoreAnswers({ answers });

  return {
    status: "ready",
    summary: {
      accuracy: answers.length > 0 ? correct / answers.length : null,
      belt: snapshot ? getBeltChange(snapshot.brainPower, after.brainPower) : null,
      bestStreak: scored.topStreak,
      brainPower: view.brainPower,
      buddyAte,
      capsulesSealed,
      ceremony,
      comesBack,
      correct,
      energy: snapshot ? { after: after.energy, before: snapshot.energy } : null,
      extraTime,
      finished: view.nextBlockId === null,
      fullMeal: view.fullMeal.earned,
      minutes: Math.floor(seconds / SECONDS_PER_MINUTE),
      missions: view.missions,
      mistakesSaved,
      netScore,
      newCards: newSkillIds.map((skillId) => ({
        description: nameOf(skillId)?.description ?? "",
        name: nameOf(skillId)?.name ?? "",
        skillId,
      })),
      preparation: { after: after.preparation, before: snapshot?.preparation ?? null },
      progress: { after: after.progress, before: snapshot?.progress ?? null },
      questions: answers.length,
      sessionId,
      skillsMoved: moves
        .filter((move) => move.from !== "new")
        .map((move) => ({ ...move, name: nameOf(move.skillId)?.name ?? "" })),
      status: session.status,
      tomorrow,
      topHyperdrive: scored.topLevel,
    },
  };
}

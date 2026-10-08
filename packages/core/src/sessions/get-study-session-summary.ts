import "server-only";
import { type Milestone, prisma } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { io } from "next/cache";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getDailyTimeLimitStatus } from "../minors/get-daily-time-limit";
import { measureSessionState } from "./_utils/capture-snapshot";
import { isCurrentSession } from "./_utils/current-session";
import { withExtraStudyCheck } from "./_utils/extra-blocks";
import {
  type SkillMove,
  loadBuddyMeal,
  loadCeremony,
  loadComesBack,
  loadSealedCapsules,
  loadSkillNames,
  loadTomorrow,
} from "./_utils/load-summary-parts";
import { getNetScore, getNetScoredItemIds } from "./_utils/net-score";
import { loadSessionAnswers } from "./_utils/session-answers";
import { countMistakesFixedToday, getSessionMissions } from "./_utils/session-missions";
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
import { type Mission } from "./missions";

type Change<TValue> = { after: TValue; before: TValue };

/**
 * The end of a session says what changed, not "lesson complete": time, questions and accuracy,
 * Brain Power (full meal included), the best Hyperdrive, Energy, belt stripes, preparation, the
 * skills that moved and the new cards, mistakes saved, when things come back, the capsules sealed,
 * what the buddy ate, tomorrow's lesson and at most one ceremony.
 */
type StudySessionSummary = {
  accuracy: number | null;
  /** The most right answers in a row on new or due material (Hyperdrive's streak). */
  bestStreak: number;
  belt: (Change<BeltLevelResult> & { colorChanged: boolean; stripesGained: number }) | null;
  brainPower: number;
  capsulesSealed: { lessonId: string; opensOn: Date | null; title: string | null }[];
  ceremony: Milestone | null;
  comesBack: { date: Date; skills: number }[];
  correct: number;
  energy: Change<number> | null;
  extraTime: ExtraTime;
  /** Every block is done or skipped. False right after "Stop for today", while the rest waits. */
  finished: boolean;
  fullMeal: boolean;
  minutes: number;
  missions: Mission[];
  mistakesSaved: number;
  /**
   * Right minus wrong on the session's net-scored questions (Cebraspe practice and swipe
   * capsules); null for a session without them.
   */
  netScore: number | null;
  newCards: { description: string; name: string; skillId: string }[];
  buddyAte: { fixes: number; newIdeas: number; reviews: number };
  preparation: Change<number | null>;
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

/**
 * Where the learner stands for the summary: as the session ended once it's complete, so playing
 * a lesson later doesn't change what the session did, else now (a session stopped for today).
 */
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

/** The end-of-session summary. */
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

  // Where the learner stands right now (a session stopped for today): read at request time,
  // never in a prerender.
  await io();

  const { session, userId } = owned;
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: input.timeZone });
  const snapshot = readSessionSnapshot(session.startSnapshot);

  const [answers, after, fixedToday, mistakesSaved, dailyLimit] = await Promise.all([
    loadSessionAnswers({ blocks: session.blocks, sessionId, userId }),
    measureSummaryState({ session, timeZone, userId }),
    countMistakesFixedToday({ localDate: session.localDate, timeZone, userId }),
    prisma.mistake.count({ where: { attempt: { studySessionId: sessionId }, userId } }),
    getDailyTimeLimitStatus(),
  ]);

  const moves = snapshot ? getMovedSkills({ current: after.skillStates, snapshot }) : [];
  const newSkillIds = moves.filter((move) => move.from === "new").map((move) => move.skillId);
  const names = await loadSkillNames(moves.map((move) => move.skillId));
  const nameOf = (skillId: string) => names.find((skill) => skill.id === skillId);

  const answeredItemIds = new Set(
    answers.flatMap((answer) => (answer.itemId ? [answer.itemId] : [])),
  );

  const view = toStudySessionView({
    answers,
    current: isCurrentSession({ now: new Date(), session, timeZone }),
    dailyLimit,
    dayMinutes: session.plannedMinutes,
    examAccess: { includesMockExams: true, trialEnded: false },
    missions: getSessionMissions({ answeredItemIds, blocks: session.blocks, fixedToday }),
    session,
    week: [],
  });

  const netScoredItemIds = getNetScoredItemIds(session.blocks);

  const [comesBack, capsulesSealed, buddyAte, ceremony, tomorrow, extraTime, netScore] =
    await Promise.all([
      loadComesBack({ answers, session, timeZone, userId }),
      loadSealedCapsules({ session, timeZone, userId }),
      loadBuddyMeal({ answers, newIdeas: newSkillIds.length, session, userId }),
      loadCeremony(userId),
      loadTomorrow({ goalId: session.goalId, userId }),
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
      minutes: view.minutes.done,
      missions: view.missions,
      mistakesSaved,
      netScore,
      newCards: newSkillIds.map((skillId) => ({
        description: nameOf(skillId)?.description ?? "",
        name: nameOf(skillId)?.name ?? "",
        skillId,
      })),
      preparation: { after: after.preparation, before: snapshot?.preparation ?? null },
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

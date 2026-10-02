import "server-only";
import { type Milestone, prisma } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getDailyTimeLimitStatus } from "../minors/get-daily-time-limit";
import { measureGoal, measureProgress } from "./_utils/capture-snapshot";
import {
  type SkillMove,
  loadBuddyMeal,
  loadCeremony,
  loadComesBack,
  loadSealedCapsules,
  loadSkillNames,
  loadTomorrow,
} from "./_utils/load-summary-parts";
import { loadSessionAnswers } from "./_utils/session-answers";
import { countMistakesFixedToday, getSessionMissions } from "./_utils/session-missions";
import { getMovedSkills, readSessionSnapshot } from "./_utils/session-snapshot";
import { toStudySessionView } from "./_utils/session-view";
import { findOwnedStudySession } from "./_utils/study-session-access";
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
  belt: (Change<BeltLevelResult> & { colorChanged: boolean; stripesGained: number }) | null;
  brainPower: number;
  capsulesSealed: { lessonId: string; opensOn: Date | null; title: string | null }[];
  ceremony: Milestone | null;
  comesBack: { date: Date; skills: number }[];
  correct: number;
  energy: Change<number> | null;
  extraTime: ExtraTime;
  fullMeal: boolean;
  minutes: number;
  missions: Mission[];
  mistakesSaved: number;
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

/** The end-of-session summary, the same numbers in both modes. */
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

  const { session, userId } = owned;
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: input.timeZone });
  const now = new Date();
  const snapshot = readSessionSnapshot(session.startSnapshot);

  const [answers, goalNow, progressNow, fixedToday, mistakesSaved, dailyLimit] = await Promise.all([
    loadSessionAnswers({ blocks: session.blocks, sessionId, userId }),
    measureGoal({ goalId: session.goalId, now, userId }),
    measureProgress({ now, timeZone, userId }),
    countMistakesFixedToday({ localDate: session.localDate, timeZone, userId }),
    prisma.mistake.count({ where: { attempt: { studySessionId: sessionId }, userId } }),
    getDailyTimeLimitStatus(),
  ]);

  const moves = snapshot ? getMovedSkills({ current: goalNow.skillStates, snapshot }) : [];
  const newSkillIds = moves.filter((move) => move.from === "new").map((move) => move.skillId);
  const names = await loadSkillNames(moves.map((move) => move.skillId));
  const nameOf = (skillId: string) => names.find((skill) => skill.id === skillId);

  const answeredItemIds = new Set(
    answers.flatMap((answer) => (answer.itemId ? [answer.itemId] : [])),
  );

  const view = toStudySessionView({
    answers,
    dailyLimit,
    dayMinutes: session.plannedMinutes,
    examAccess: { includesMockExams: true, trialEnded: false },
    missions: getSessionMissions({ answeredItemIds, blocks: session.blocks, fixedToday }),
    session,
    week: [],
  });

  const [comesBack, capsulesSealed, buddyAte, ceremony, tomorrow] = await Promise.all([
    loadComesBack({ answers, timeZone, userId }),
    loadSealedCapsules({ session, timeZone, userId }),
    loadBuddyMeal({ answers, newIdeas: newSkillIds.length, session, userId }),
    loadCeremony(userId),
    loadTomorrow(session.goalId),
  ]);

  const correct = answers.filter((answer) => answer.isCorrect).length;

  return {
    status: "ready",
    summary: {
      accuracy: answers.length > 0 ? correct / answers.length : null,
      belt: snapshot ? getBeltChange(snapshot.brainPower, progressNow.brainPower) : null,
      brainPower: view.brainPower,
      buddyAte,
      capsulesSealed,
      ceremony,
      comesBack,
      correct,
      energy: snapshot ? { after: progressNow.energy, before: snapshot.energy } : null,
      extraTime: view.extraTime,
      fullMeal: view.fullMeal.earned,
      minutes: view.minutes.done,
      missions: view.missions,
      mistakesSaved,
      newCards: newSkillIds.map((skillId) => ({
        description: nameOf(skillId)?.description ?? "",
        name: nameOf(skillId)?.name ?? "",
        skillId,
      })),
      preparation: { after: goalNow.preparation, before: snapshot?.preparation ?? null },
      questions: answers.length,
      sessionId,
      skillsMoved: moves
        .filter((move) => move.from !== "new")
        .map((move) => ({ ...move, name: nameOf(move.skillId)?.name ?? "" })),
      status: session.status,
      tomorrow,
      topHyperdrive: scoreAnswers({ answers }).topLevel,
    },
  };
}

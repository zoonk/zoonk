import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { after } from "next/server";
import { type AnalyticsEvent } from "../../analytics/events";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { type CheckpointOutcome } from "../../checkpoints/_utils/checkpoint-outcome";
import { type BlockPayload } from "../block-payload";
import { getHyperdriveLevel, scoreAnswers } from "../brain-power";
import { trackCapsulesOpened } from "./capsule-events";
import { getGoalDayMinutes } from "./day-minutes";
import { type SessionAnswer, loadSessionAnswers } from "./session-answers";
import { sumSessionSeconds } from "./session-ledger";
import { getSessionBar } from "./session-view";
import { type QuestionBlockSettlement } from "./settle-question-block";
import { type StudySessionRow } from "./study-session-access";

const SECONDS_PER_MINUTE = 60;

type SessionRef = Pick<StudySessionRow, "goalId" | "id" | "userId">;

/** Server-side outcomes prevent ad blockers from hiding them; defer delivery until after the response. */
function trackSessionEvent({ event, session }: { event: AnalyticsEvent; session: SessionRef }) {
  after(() =>
    trackLearnerEvents({ events: [event], goalId: session.goalId, userId: session.userId }),
  );
}

/** Call on the first block start; later starts count as resumes. */
export function trackSessionStarted(session: StudySessionRow): void {
  trackSessionEvent({
    event: {
      name: "Session Started",
      properties: {
        blocks: session.blocks.length,
        planned_minutes: session.plannedMinutes,
        session_id: session.id,
      },
    },
    session,
  });
}

/** Call once after the block is marked done. */
export function trackBlockCompleted({
  block,
  seconds,
  session,
}: {
  block: Pick<StudySessionBlock, "kind" | "position">;
  seconds: number;
  session: SessionRef;
}): void {
  trackSessionEvent({
    event: {
      name: "Block Completed",
      properties: {
        block_kind: block.kind,
        position: block.position,
        seconds,
        session_id: session.id,
      },
    },
    session,
  });
}

async function isDailyGoalMet({
  minutes,
  session,
}: {
  minutes: number;
  session: StudySessionRow;
}): Promise<boolean> {
  if (!session.goal) {
    return false;
  }

  const plan = await prisma.plan.findUnique({
    select: { settings: true },
    where: { goalId: session.goal.id },
  });

  const dailyGoal = getGoalDayMinutes({
    date: session.localDate,
    goal: session.goal,
    planSettings: plan?.settings,
  });

  return minutes >= dailyGoal;
}

/** Pass the completed session with final block states; stopping for the day does not count as completion. */
export function trackSessionCompleted(session: StudySessionRow): void {
  after(() =>
    safeAsync(async () => {
      const seconds = await sumSessionSeconds(prisma, {
        sessionId: session.id,
        userId: session.userId,
      });

      const minutes = Math.round(seconds / SECONDS_PER_MINUTE);

      const event: AnalyticsEvent = {
        name: "Session Completed",
        properties: {
          blocks_completed: getSessionBar(session.blocks).completed,
          daily_goal_met: await isDailyGoalMet({ minutes, session }),
          minutes,
          session_id: session.id,
        },
      };

      await trackLearnerEvents({ events: [event], goalId: session.goalId, userId: session.userId });
    }),
  );
}

function trackCheckpointCompleted({
  checkpoint,
  session,
}: {
  checkpoint: CheckpointOutcome | null;
  session: SessionRef;
}): void {
  if (!checkpoint) {
    return;
  }

  trackSessionEvent({
    event:
      checkpoint.kind === "weekly"
        ? {
            name: "Big Challenge Finished",
            properties: { correct: checkpoint.correct, questions: checkpoint.total },
          }
        : {
            name: "Boss Finished",
            properties: {
              boss: checkpoint.kind === "finalBoss" ? "final" : "phase",
              passed: checkpoint.passed,
            },
          },
    session,
  });
}

function trackHyperdriveReached({
  answers,
  attemptId,
  session,
}: {
  answers: readonly SessionAnswer[];
  attemptId: string;
  session: SessionRef;
}): void {
  const multiplier = getHyperdriveLevel(scoreAnswers({ answers }).streak);

  const previous = getHyperdriveLevel(
    scoreAnswers({ answers: answers.filter((answer) => answer.id !== attemptId) }).streak,
  );

  if (multiplier >= 2 && multiplier > previous) {
    trackSessionEvent({
      event: { name: "Hyperdrive Reached", properties: { multiplier } },
      session,
    });
  }
}

export async function loadAnsweredSession({
  session,
  attemptId,
  created,
}: {
  session: StudySessionRow;
  attemptId: string;
  created: boolean;
}) {
  const answers = await loadSessionAnswers({
    blocks: session.blocks,
    sessionId: session.id,
    userId: session.userId,
  });

  if (created) {
    trackHyperdriveReached({ answers, attemptId, session });
  }

  return answers;
}

export function trackQuestionBlockCompleted({
  block,
  payload,
  session,
  settlement,
}: {
  block: StudySessionBlock;
  payload: BlockPayload;
  session: StudySessionRow;
  settlement: QuestionBlockSettlement;
}): void {
  trackBlockCompleted({ block, seconds: settlement.seconds, session });

  trackCheckpointCompleted({
    checkpoint: payload.checkpoint?.mock ? null : settlement.checkpoint,
    session,
  });

  if (block.kind === "review") {
    trackCapsulesOpened({ answers: settlement.answers, payload, session });
  }
}

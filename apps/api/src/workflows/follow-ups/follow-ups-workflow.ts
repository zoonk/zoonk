import { type OwedFollowUp } from "@zoonk/core/follow-ups/contract";
import { start } from "workflow/api";
import { repeatUntil } from "../_shared/repeat-until";
import { claimRunToken } from "../_shared/run-token";
import { callContentWorkflow } from "../calls/call-content-workflow";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { sessionPreparationWorkflow } from "../sessions/session-preparation-workflow";
import { backgroundTaskWorkflow } from "./background-task-workflow";
import {
  countFollowUpsStep,
  endFollowUpStep,
  listFollowUpsStep,
  requestLessonWritingStep,
} from "./steps/follow-up-steps";

const MAX_PASSES = 20;

export type FollowUpsInput = { userId: string };

export type FollowUpsResult = { status: "alreadyRunning" | "done" };

/** `start()` in a workflow is a step, so a replay never starts the same run twice. */
async function startFollowUp(followUp: OwedFollowUp): Promise<void> {
  const { userId } = followUp;

  switch (followUp.kind) {
    case "prepareSession":
      await start(sessionPreparationWorkflow, [{ sessionId: followUp.input.sessionId, userId }]);
      return;
    case "prepareGoalLessons":
      await start(sessionPreparationWorkflow, [{ ...followUp.input, userId }]);
      return;
    case "writeLesson": {
      const writing = await requestLessonWritingStep({ lessonId: followUp.input.lessonId, userId });

      if (writing) {
        await start(lessonContentWorkflow, [writing]);
      }

      return;
    }
    case "checkDailyInsight":
    case "checkFactSensitivity":
    case "classifyMistakeCause":
    case "findMistakePattern":
    case "rememberOnboarding":
    case "rememberSession":
    case "voiceWord":
      await start(backgroundTaskWorkflow, [followUp]);
      return;
    case "writeSpeakingPaper": {
      const { mockId } = followUp.input;
      await start(callContentWorkflow, [{ kind: "speakingPaper", mockId, userId }]);
      return;
    }
    default:
      followUp satisfies never;
  }
}

/** A row asked for again while its run started survives its end and starts on the next pass. */
async function runFollowUp(followUp: OwedFollowUp): Promise<void> {
  await startFollowUp(followUp);
  await endFollowUpStep({ id: followUp.id, revision: followUp.revision });
}

async function runPass(userId: string): Promise<number> {
  const followUps = await listFollowUpsStep(userId);
  await Promise.all(followUps.map((followUp) => runFollowUp(followUp)));

  return followUps.length;
}

/** One run per learner at a time; a stopped holder's rows stay for the next one. */
async function runOwedWork(userId: string): Promise<boolean> {
  using claim = await claimRunToken(`follow-ups:${userId}`);

  if (claim.conflict) {
    return false;
  }

  await repeatUntil({
    done: (count) => count === 0,
    run: () => runPass(userId),
    times: MAX_PASSES,
  });

  return true;
}

export async function followUpsWorkflow({ userId }: FollowUpsInput): Promise<FollowUpsResult> {
  "use workflow";

  if (!(await runOwedWork(userId))) {
    return { status: "alreadyRunning" };
  }

  // Work asked for while this run held the learner went to a run that saw it and exited.
  if ((await countFollowUpsStep(userId)) > 0) {
    await start(followUpsWorkflow, [{ userId }]);
  }

  return { status: "done" };
}

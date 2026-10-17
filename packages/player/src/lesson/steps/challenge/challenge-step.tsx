"use client";

import { getChallengeProgress, pickChallengeChoice } from "../../_utils/challenge-progress";
import { useLessonPlayer } from "../../lesson-player-context";
import { type LessonStepViewProps, type StepOf } from "../lesson-step-view-props";
import { ChallengeConversation } from "./challenge-conversation";
import { ChallengeDebriefView } from "./challenge-debrief";
import { ChallengeIntro } from "./challenge-intro";
import { useChallengeNames } from "./use-challenge-names";

/**
 * A case solved like at work: the intro, then a conversation where each confirmed decision
 * brings the team's replies, moves the meters and may jump ahead in time, then the ending and,
 * once checked, the debrief. The path is the answer; the learner always finishes.
 */
export function ChallengeStepView({
  answer,
  isLocked,
  onAnswer,
  result,
  step,
}: LessonStepViewProps<StepOf<"challenge">>) {
  const { state } = useLessonPlayer();
  const names = useChallengeNames(step.content.team);
  const progress = getChallengeProgress({ answer, shown: state.revealed[step.id] ?? 0, step });

  if (progress.stage === "intro") {
    return <ChallengeIntro content={step.content} names={names} />;
  }

  if (result && progress.stage === "ended") {
    return (
      <ChallengeDebriefView content={step.content} names={names} steps={progress.walk.steps} />
    );
  }

  return (
    <ChallengeConversation
      content={step.content}
      isLocked={isLocked}
      names={names}
      onPick={(choiceId) =>
        onAnswer(pickChallengeChoice({ choiceId, confirmed: progress.confirmed }))
      }
      progress={progress}
    />
  );
}

import {
  finishChallengeDraftStep,
  planChallengeStep,
  reviewChallengeStep,
  scriptChallengeStep,
} from "./steps/challenge-draft-steps";
import {
  type ChallengeDraftStage,
  type LessonWriteOutcome,
  type WriteInput,
} from "./steps/write-lesson-content-step";

export async function writeChallengeDraft({
  input,
  stage,
}: {
  input: WriteInput;
  stage: ChallengeDraftStage;
}): Promise<LessonWriteOutcome> {
  const planned = await planChallengeStep(stage);

  if (planned.problems.length > 0) {
    return finishChallengeDraftStep({
      input,
      model: planned.provenance.model,
      problems: planned.problems,
      stage,
    });
  }

  const scripted = await scriptChallengeStep({ planned, stage });

  const problems =
    scripted.problems.length > 0 || !stage.review
      ? scripted.problems
      : await reviewChallengeStep({ scripted, stage });

  return finishChallengeDraftStep({
    input,
    model: scripted.provenance.model,
    problems,
    scripted,
    stage,
  });
}

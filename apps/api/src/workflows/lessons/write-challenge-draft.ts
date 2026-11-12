import { type ChallengeDraft } from "@zoonk/core/library/challenges/draft";
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

export async function draftChallenge({
  lessonId,
  stage,
}: {
  lessonId?: string;
  stage: ChallengeDraftStage;
}): Promise<ChallengeDraft> {
  const planned = await planChallengeStep({ lessonId, stage });

  if (planned.problems.length > 0) {
    return { model: planned.provenance.model, problems: planned.problems };
  }

  const scripted = await scriptChallengeStep({ lessonId, planned, stage });

  if ("problems" in scripted || !stage.review) {
    return scripted;
  }

  const problems = await reviewChallengeStep({ lessonId, scripted, stage });

  return problems.length > 0 ? { model: scripted.provenance.model, problems } : scripted;
}

export async function writeChallengeDraft({
  input,
  stage,
}: {
  input: WriteInput;
  stage: ChallengeDraftStage;
}): Promise<LessonWriteOutcome> {
  const draft = await draftChallenge({ lessonId: input.lessonId, stage });
  return finishChallengeDraftStep({ draft, input, stage });
}

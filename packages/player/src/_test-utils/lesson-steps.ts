import {
  type PlayableSpokenAnswerStep,
  type PlayableStepImage,
  type PlayableTeachingStepOf,
  type TeachingStepKind,
} from "@zoonk/core/lesson-player/contract";
import { parseStepContent } from "@zoonk/core/library/steps/contract";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";

/**
 * Lesson screens as the server serves them: stored content parsed the way the lesson read parses
 * it, from the shared valid fixtures unless a test passes its own.
 */

/** Any activity step content; tests that vary a fixture pass plain objects built from it. */
export type ActivityContent = { [field: string]: unknown; template: string };

type ScreenKind = Exclude<TeachingStepKind, "activity" | "spokenAnswer">;

function playableStep<TKind extends TeachingStepKind>(
  kind: TKind,
  {
    content,
    image = null,
    imagePending = false,
  }: { content: object; image?: PlayableStepImage | null; imagePending?: boolean },
): PlayableTeachingStepOf<TKind> {
  return {
    citation: null,
    content: parseStepContent(kind, content),
    id: crypto.randomUUID(),
    image,
    imagePending,
    kind,
    position: 0,
    skillId: null,
  };
}

export function activityStep({
  content,
  image,
}: {
  content: ActivityContent;
  image?: PlayableStepImage | null;
}): PlayableTeachingStepOf<"activity"> {
  return playableStep("activity", { content, image });
}

/** An explanation with its own stored content, such as its own personal example slot or none. */
export function explanationStep(content: object): PlayableTeachingStepOf<"explanation"> {
  return playableStep("explanation", { content });
}

/** A teaching screen of the shared stored content for its kind. */
export function teachingStep<TKind extends ScreenKind>(kind: TKind): PlayableTeachingStepOf<TKind> {
  return playableStep(kind, { content: playableStepContent[kind] });
}

/**
 * The shared "say it out loud" screen. No sentence of the lesson is behind it, so it has no
 * listening exercise to swap in for "I can't talk now".
 */
export function spokenAnswerStep(): PlayableSpokenAnswerStep {
  return {
    ...playableStep("spokenAnswer", { content: playableStepContent.spokenAnswer }),
    listening: null,
  };
}

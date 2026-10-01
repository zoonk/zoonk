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
  { content, image = null }: { content: object; image?: PlayableStepImage | null },
): PlayableTeachingStepOf<TKind> {
  return {
    citation: null,
    content: parseStepContent(kind, content),
    id: crypto.randomUUID(),
    image,
    kind,
    position: 0,
    skillId: null,
    variants: { deeper: null, simpler: null },
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

/** The shared explanation with a stored "Simpler" version, which the lesson read includes. */
export function explanationWithSimpler(text: string): PlayableTeachingStepOf<"explanation"> {
  const simpler = { content: parseStepContent("explanation", { text }), id: crypto.randomUUID() };
  return { ...teachingStep("explanation"), variants: { deeper: null, simpler } };
}

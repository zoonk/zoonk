import "server-only";
import { decideBoolean } from "../../evaluate/decisions";
import { evaluateQuestions } from "../../evaluate/evaluate-questions";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import instructions from "./picture-need.prompt.md";

/** The picture-need eval's runner-up after Jev (8 Oct 2026). */
const fallbackModel = "openai/gpt-6-luna";

/**
 * A missing teaching picture costs the learner more than one picture too many. On the level-aware
 * eval (2 Nov 2026) this caught 7 of 12 decorative pictures and dropped 2 of 43 that teach; 0.5
 * caught 9 and dropped 3.
 */
const TEACHES_AT = 0.45;

export const pictureNeedClassifier = {
  question: {
    criteria: {
      false:
        "It repeats numbers or text, repeats the picture before or gives the answer away; at overview and beginner its main subject is something the words don't name; at intermediate and advanced the words already say all it shows or it shows something everyone knows.",
      true: "A learner who only read the words would have to imagine what the picture shows, the question is about the picture itself, or, at overview and beginner, it shows the screen's own example.",
    },
    instructions,
    type: "boolean",
  } as const,
  toInput: ({
    lesson,
    level,
    picture,
    previousPicture,
    screen,
  }: {
    lesson: string;
    level: CourseLevel;
    picture: string;
    previousPicture: string | null;
    screen: { brief: string; kind: string };
  }) => ({
    LESSON: lesson,
    LEVEL: level,
    PICTURE: picture,
    PREVIOUS_PICTURE: previousPicture ?? "none",
    SCREEN: `${screen.kind}: ${screen.brief}`,
  }),
};

type PictureNeedInput = Parameters<typeof pictureNeedClassifier.toInput>[0];

/** Throws when neither model answers, so the caller's workflow step retries it. */
export async function judgePicture({
  analytics,
  ...input
}: PictureNeedInput & { analytics?: AiGenerationContext }): Promise<boolean> {
  const run = await evaluateQuestions({
    analytics,
    fallbackModel,
    input: pictureNeedClassifier.toInput(input),
    keepInput: true,
    questions: { teaches: pictureNeedClassifier.question },
    task: "picture-need",
  });

  return decideBoolean({ probability: run.answers.teaches.probability, threshold: TEACHES_AT });
}

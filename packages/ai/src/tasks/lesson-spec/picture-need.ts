import "server-only";
import { decideBoolean } from "../../evaluate/decisions";
import { evaluateQuestions } from "../../evaluate/evaluate-questions";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import instructions from "./picture-need.prompt.md";

/**
 * At the 0.35 cutoff on 63 cases (8 Nov 2026), Jev got 59 (EN 35/37, PT 24/26) at $0.0637 per 1k
 * and Elephant 55, keeping the same 40 teaching pictures. Mammoth kept all 42 but passed 9
 * decorative ones, each an image to pay for.
 */
const fallbackModel = "baseten/elephant-1";

/**
 * On Jev's 63 cases (8 Nov 2026, scenes' and questions' pictures included), this kept 40 of 42
 * pictures that teach and caught 19 of 21 decorative ones; 0.3 caught 2 fewer and 0.4 dropped one
 * more that teaches.
 */
const TEACHES_AT = 0.35;

export const pictureNeedClassifier = {
  question: {
    criteria: {
      false:
        "A template, table, chart or timeline would show it better (steps, causes, a changing value, amounts, data or dates); it shows the story or an everyday situation again with nothing to see; it repeats numbers or text, repeats the picture before or shows the result to work out; its main subject is something the words don't name; the words already say all it shows, or it shows something everyone knows.",
      true: "A learner who only read the words would have to see it to understand: how something looks, is built or is arranged, two things only seeing can compare, a setup they work from, a setup too complex for any template, a thing, place or structure nobody sees in daily life, or the learner answering by looking at it.",
    },
    instructions,
    type: "boolean",
  } as const,
  toInput: ({
    lesson,
    picture,
    previousPicture,
    screen,
  }: {
    lesson: string;
    picture: string;
    previousPicture: string | null;
    screen: { brief: string; kind: string };
  }) => ({
    LESSON: lesson,
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

import "server-only";
import { decideBoolean } from "../../evaluate/decisions";
import { evaluateQuestions } from "../../evaluate/evaluate-questions";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import instructions from "./picture-need.prompt.md";

/** The picture-need eval's runner-up after Jev (8 Oct 2026). */
const fallbackModel = "openai/gpt-6-luna";

/**
 * A missing teaching picture costs the learner more than one picture too many. On Jev's eval run (3
 * Nov 2026, scene pictures aside, which are never judged) this caught 11 of 11 decorative pictures
 * and dropped none of 31 that teach; 0.4 dropped 1.
 */
const TEACHES_AT = 0.35;

export const pictureNeedClassifier = {
  question: {
    criteria: {
      false:
        "A template, table, chart or timeline would show it better (steps, causes, a decision, a changing value, amounts, data or dates); it shows the story or an everyday situation again with nothing to see; it repeats numbers or text, repeats the picture before or shows the result to work out; for new learners its main subject is something the words don't name; for experienced learners the words already say all it shows or it shows something everyone knows.",
      true: "A learner who only read the words would have to see it to understand: how something looks, is built or is arranged, two things only seeing can compare, a setup they work from, a setup too complex for any template, the learner answering by looking at it, or, for new learners, a thing, place or structure they don't see in daily life.",
    },
    instructions,
    type: "boolean",
  } as const,
  toInput: ({
    lesson,
    novice,
    picture,
    previousPicture,
    screen,
  }: {
    lesson: string;
    /** `readsNoviceRules` for the lesson, so a picture is judged by the rules it was planned by. */
    novice: boolean;
    picture: string;
    previousPicture: string | null;
    screen: { brief: string; kind: string };
  }) => ({
    LEARNERS: novice ? "new" : "experienced",
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

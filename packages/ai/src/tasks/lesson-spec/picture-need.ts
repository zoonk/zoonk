import "server-only";
import { decideBoolean } from "../../evaluate/decisions";
import { evaluateQuestions } from "../../evaluate/evaluate-questions";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import instructions from "./picture-need.prompt.md";

/** The picture-need eval's runner-up after Jev (8 Oct 2026). */
const fallbackModel = "openai/gpt-6-luna";

/**
 * A missing teaching picture costs the learner more than one picture too many. On the eval (2 Nov
 * 2026) this caught 7 of 12 decorative pictures and dropped 1 of 43 that teach; 0.5 caught 10 and
 * dropped 4.
 */
const TEACHES_AT = 0.45;

export const pictureNeedClassifier = {
  question: {
    criteria: {
      false:
        "It repeats numbers or text, repeats the picture before or gives the answer away; for new learners its main subject is something the words don't name; for experienced learners the words already say all it shows or it shows something everyone knows.",
      true: "A learner who only read the words would have to imagine what the picture shows, the question is about the picture itself, or, for new learners, it shows the screen's own example.",
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

export type PictureJudgment = { probability: number; teaches: boolean };

/** Throws when neither model answers, so the caller's workflow step retries it. */
export async function judgePicture({
  analytics,
  ...input
}: PictureNeedInput & { analytics?: AiGenerationContext }): Promise<PictureJudgment> {
  const run = await evaluateQuestions({
    analytics,
    fallbackModel,
    input: pictureNeedClassifier.toInput(input),
    keepInput: true,
    questions: { teaches: pictureNeedClassifier.question },
    task: "picture-need",
  });

  const { probability } = run.answers.teaches;

  return { probability, teaches: decideBoolean({ probability, threshold: TEACHES_AT }) };
}

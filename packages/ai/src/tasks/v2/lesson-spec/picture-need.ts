import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { decideBoolean } from "../../../evaluate/decisions";
import { evaluateQuestions } from "../../../evaluate/evaluate-questions";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { type LessonSpec } from "./lesson-spec-rules";
import instructions from "./picture-need.prompt.md";

/**
 * The runner-up from the picture-need eval (52 planned pictures labeled by hand, 8 Oct 2026): Jev
 * scored 84.6% at $0.04 per 1,000 checks and 0.4 s, Luna 76.9% at $0.11 and 1.4 s (on the
 * prompt's first wording). Used when Jev errors, times out or can't fit the input.
 */
const fallbackModel = "openai/gpt-6-luna";

/**
 * A planned picture is dropped only when the model is fairly sure it decorates: a picture that
 * teaches and goes missing costs the learner more than drawing one picture too many. On the eval,
 * this cutoff caught 11 of 16 decorative pictures and dropped 2 of 36 that teach; 0.5 caught 12
 * and dropped 4.
 */
const TEACHES_AT = 0.45;

/**
 * Whether a planned picture shows something the learner would otherwise have to imagine, asked
 * of any evaluation model: Jev natively, other models through the evaluation adapter, so the
 * eval and production ask the same thing.
 */
export const pictureNeedClassifier = {
  question: {
    criteria: {
      false:
        "The words already say everything the picture shows, or it repeats numbers or text, shows something everyone knows, repeats the picture before or gives the answer away.",
      true: "A learner who only read the words would have to imagine what the picture shows, or the question is about the picture itself.",
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

/**
 * Removes the pictures a lesson spec planned that would only decorate, before the writer asks for
 * them and before anything is drawn: one cheap decision per planned picture, all at once. Native
 * visuals (tables, charts, timelines, explored templates) aren't pictures and stay as planned. A
 * picture whose check fails stays.
 */
export async function keepTeachingPictures({
  analytics,
  spec,
}: {
  analytics?: AiGenerationContext;
  spec: LessonSpec;
}): Promise<LessonSpec> {
  const verdicts = await Promise.all(
    spec.screens.map(async (screen, index) => {
      const picture = screen.visual;

      if (!picture) {
        return true;
      }

      const run = await safeAsync(() =>
        evaluateQuestions({
          analytics,
          fallbackModel,
          input: pictureNeedClassifier.toInput({
            lesson: spec.title,
            picture,
            previousPicture: spec.screens[index - 1]?.visual ?? null,
            screen,
          }),
          keepInput: true,
          questions: { teaches: pictureNeedClassifier.question },
          task: "picture-need",
        }),
      );

      // A check that can't run keeps the picture: the plan asked for it.
      return run.error
        ? true
        : decideBoolean({
            probability: run.data.answers.teaches.probability,
            threshold: TEACHES_AT,
          });
    }),
  );

  return {
    ...spec,
    screens: spec.screens.map((screen, index) =>
      verdicts[index] ? screen : { ...screen, visual: null },
    ),
  };
}

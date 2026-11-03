import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { decideBoolean } from "../../evaluate/decisions";
import { evaluateQuestions } from "../../evaluate/evaluate-questions";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type LessonSpec } from "./lesson-spec-rules";
import instructions from "./picture-need.prompt.md";

/** The picture-need eval's runner-up after Jev (8 Oct 2026). */
const fallbackModel = "openai/gpt-6-luna";

/**
 * A missing teaching picture costs the learner more than one picture too many. On the eval (3 Nov
 * 2026) this caught 13 or 14 of 16 decorative pictures and dropped none of 36 that teach; 0.5
 * caught 15 and dropped 1 or 2.
 */
const TEACHES_AT = 0.45;

export const pictureNeedClassifier = {
  question: {
    criteria: {
      false:
        "The words let anyone picture it correctly, or it repeats numbers or text, shows something everyone knows, repeats the picture before or shows the answer to work out.",
      true: "A learner who only read the words would have to imagine how something looks, is built or is arranged, or answers by looking at the picture.",
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

/** Native visuals (tables, charts, timelines) aren't pictures and stay as planned. */
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

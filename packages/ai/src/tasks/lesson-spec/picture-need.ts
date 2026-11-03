import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { decideBoolean } from "../../evaluate/decisions";
import { evaluateQuestions } from "../../evaluate/evaluate-questions";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import { type LessonSpec } from "./lesson-spec-rules";
import instructions from "./picture-need.prompt.md";

/** The picture-need eval's runner-up after Jev (8 Oct 2026). */
const fallbackModel = "openai/gpt-6-luna";

/**
 * A missing teaching picture costs the learner more than one picture too many. On the eval this
 * caught 11 of 16 decorative pictures and dropped 2 of 36 that teach; 0.5 dropped 4.
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

/** Native visuals (tables, charts, timelines) aren't pictures and stay as planned. */
export async function keepTeachingPictures({
  analytics,
  level,
  spec,
}: {
  analytics?: AiGenerationContext;
  level: CourseLevel;
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
            level,
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

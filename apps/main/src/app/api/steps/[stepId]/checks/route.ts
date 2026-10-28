import { appPostRoute, readJsonBody } from "@/lib/http/app-post-route";
import { checkLessonStep } from "@zoonk/core/lesson-player/check";
import { lessonStepCheckInputSchema } from "@zoonk/core/lesson-player/contract";
import { type LessonCheckOutcome } from "@zoonk/player/lesson/types";
import { z } from "zod";

const stepIdSchema = z.uuid();

/** The player resends a 500; a finished run or an answer that doesn't fit the screen is a refusal no retry changes. */
export const POST = appPostRoute<{ stepId: string }>(
  "lessonStepCheckRoute",
  async (request, { stepId }): Promise<LessonCheckOutcome> => {
    const input = lessonStepCheckInputSchema.safeParse(await readJsonBody(request));

    if (!input.success || !stepIdSchema.safeParse(stepId).success) {
      return { status: "refused" };
    }

    const outcome = await checkLessonStep({ input: input.data, stepId });

    return outcome.status === "checked"
      ? { result: outcome.result, status: "checked" }
      : { status: "refused" };
  },
);

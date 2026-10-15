import { appPostRoute, readJsonBody } from "@/lib/http/app-post-route";
import { checkLessonStep } from "@zoonk/core/lesson-player/check";
import { lessonStepCheckInputSchema } from "@zoonk/core/lesson-player/contract";
import { type LessonCheckOutcome } from "@zoonk/player/lesson/types";
import { z } from "zod";

const stepIdSchema = z.uuid();

/**
 * The web player's step check: answers graded on the device, saved in the background, and typed
 * answers waiting for their grade, through the same core capability as
 * `POST /v1/steps/{stepId}/checks`. A failure (a 500) is one the player sends again; a finished
 * run or an answer that doesn't fit the screen is a refusal, which no retry changes.
 */
export const POST = appPostRoute<{ stepId: string }>(
  "lessonStepCheckRoute",
  async (request, { stepId }): Promise<LessonCheckOutcome> => {
    const input = lessonStepCheckInputSchema.safeParse(await readJsonBody(request));

    // An answer that doesn't fit the contract never will: sending it again would only loop.
    if (!input.success || !stepIdSchema.safeParse(stepId).success) {
      return { status: "refused" };
    }

    const outcome = await checkLessonStep({ input: input.data, stepId });

    return outcome.status === "checked"
      ? { result: outcome.result, status: "checked" }
      : { status: "refused" };
  },
);

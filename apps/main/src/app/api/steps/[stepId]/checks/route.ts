import { appPostRoute, readJsonBody } from "@/lib/http/app-post-route";
import { checkLessonStep } from "@zoonk/core/lesson-player/check";
import { lessonStepCheckInputSchema } from "@zoonk/core/lesson-player/contract";
import { type LessonCheckOutcome } from "@zoonk/player/lesson/types";
import { uuidSchema } from "@zoonk/utils/uuid-schema";

const stepIdSchema = uuidSchema();

/**
 * The player keeps and resends a 500 or an answer sent after its session ended (it may come back);
 * a finished run or an answer that doesn't fit the screen is a refusal no retry changes.
 */
export const POST = appPostRoute<{ stepId: string }>(
  "lessonStepCheckRoute",
  async (request, { stepId }): Promise<LessonCheckOutcome> => {
    const input = lessonStepCheckInputSchema.safeParse(await readJsonBody(request));

    if (!input.success || !stepIdSchema.safeParse(stepId).success) {
      return { status: "refused" };
    }

    const outcome = await checkLessonStep({ input: input.data, stepId });

    if (outcome.status === "checked") {
      return { result: outcome.result, status: "checked" };
    }

    return outcome.status === "unauthorized" ? { status: "failed" } : { status: "refused" };
  },
);

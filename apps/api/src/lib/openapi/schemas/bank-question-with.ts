import { z } from "zod";
import { bankQuestionSchema } from "./learner";

/**
 * A bank question with fields of its own (a drill's set, a focus test's area), as one closed
 * object per format. An intersection with another closed object never decodes in a strict client
 * (each side refuses the other's keys), which the native apps' generated clients are.
 */
export function bankQuestionWith<Shape extends z.ZodRawShape>(shape: Shape) {
  const [multipleChoice, trueFalse] = bankQuestionSchema.options;
  return z.discriminatedUnion("format", [multipleChoice.extend(shape), trueFalse.extend(shape)]);
}

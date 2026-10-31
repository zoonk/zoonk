import { z } from "zod";
import { bankQuestionSchema } from "./learner";

export function bankQuestionWith<Shape extends z.ZodRawShape>(shape: Shape) {
  const [multipleChoice, trueFalse] = bankQuestionSchema.options;
  return z.discriminatedUnion("format", [multipleChoice.extend(shape), trueFalse.extend(shape)]);
}

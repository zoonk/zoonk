import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { type FieldChange } from "./fix-handler";

export function extraData(fields: readonly FieldChange[]) {
  const values = Object.fromEntries(fields.map(({ field, after }) => [field, after]));

  return {
    ...(isJsonObject(values.landingPage) ? { landingPage: values.landingPage } : {}),
    ...(Array.isArray(values.objectives)
      ? { objectives: z.array(z.string()).parse(values.objectives) }
      : {}),
    ...(Array.isArray(values.relatedQuestions)
      ? { relatedQuestions: z.array(z.string()).parse(values.relatedQuestions) }
      : {}),
    ...("canDo" in values ? { canDo: z.string().nullable().parse(values.canDo) } : {}),
  };
}

import { GoalKind } from "@zoonk/db/enums";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const goalReferenceSchema = z.object({
  displayName: z.string(),
  id: uuidSchema(),
  kind: z.enum(GoalKind),
  title: z.string(),
});

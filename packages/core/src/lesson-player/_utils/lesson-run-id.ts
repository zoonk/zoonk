import { uuidSchema } from "@zoonk/utils/uuid-schema";

export const lessonRunIdSchema = uuidSchema().meta({
  description: "The lesson run returned by the start, which answers count toward",
});

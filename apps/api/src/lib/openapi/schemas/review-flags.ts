import { z } from "zod";

export const reviewFlagPathParamsSchema = z
  .object({ flagId: z.uuid().meta({ description: "Content review flag ID" }) })
  .meta({ id: "ReviewFlagPathParams" });

export const reviewFlagRewriteSchema = z
  .object({ runId: z.string().meta({ description: "The rewrite's workflow run" }) })
  .meta({ id: "ReviewFlagRewrite" });

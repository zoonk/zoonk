import { z } from "zod";

export const launchVideoSchema = z.object({
  locale: z.enum(["en", "pt-br"]).default("en"),
});

export type LaunchVideoProps = z.infer<typeof launchVideoSchema>;

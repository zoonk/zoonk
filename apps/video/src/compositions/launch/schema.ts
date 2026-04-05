import { z } from "zod";

export const launchVideoSchema = z.object({});

export type LaunchVideoProps = z.infer<typeof launchVideoSchema>;

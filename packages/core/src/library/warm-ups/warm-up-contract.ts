import { warmUpCardSchema } from "@zoonk/ai/tasks/warm-up/warm-up-cards";
import { z } from "zod";

export const warmUpDeckSchema = z
  .object({ cards: z.array(warmUpCardSchema), id: z.uuid(), language: z.string() })
  .meta({ id: "WarmUpDeck" });

export type WarmUpDeck = z.infer<typeof warmUpDeckSchema>;

export type WarmUpCard = WarmUpDeck["cards"][number];

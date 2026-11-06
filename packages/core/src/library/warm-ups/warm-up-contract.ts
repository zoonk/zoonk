import { warmUpCardSchema } from "@zoonk/ai/tasks/warm-up/warm-up-cards";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const warmUpDeckSchema = z
  .object({ cards: z.array(warmUpCardSchema), id: uuidSchema(), language: z.string() })
  .meta({ id: "WarmUpDeck" });

export type WarmUpDeck = z.infer<typeof warmUpDeckSchema>;

export type WarmUpCard = WarmUpDeck["cards"][number];

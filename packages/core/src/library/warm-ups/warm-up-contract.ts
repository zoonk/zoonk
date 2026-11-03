import { z } from "zod";

const warmUpCardSchema = z.object({
  id: z.string(),
  options: z.array(z.object({ correct: z.boolean(), id: z.string(), text: z.string() })),
  question: z.string(),
  reveal: z.string(),
});

export const warmUpDeckSchema = z
  .object({ cards: z.array(warmUpCardSchema), id: z.uuid(), language: z.string() })
  .meta({ id: "WarmUpDeck" });

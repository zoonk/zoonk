import { z } from "zod";

export const cited = { document: z.number().int(), passage: z.string() };

/** Facts a notice states in several places cite each passage. */
export const citedMany = { passages: z.array(z.object(cited)) };

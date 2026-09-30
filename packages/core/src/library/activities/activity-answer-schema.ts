import { z } from "zod";
import { MAX_DEVICE_DELAY_MS, MIN_DEVICE_DELAY_MS } from "./templates/_utils/music";

const MAX_ANSWER_ITEMS = 200;
const MAX_ANSWER_TEXT = 2000;

const answerTextSchema = z.string().max(MAX_ANSWER_TEXT);
const answerIdsSchema = z.array(answerTextSchema).max(MAX_ANSWER_ITEMS);
const cellSchema = z.union([answerTextSchema, z.number(), z.null()]);

/**
 * What a learner submits for an activity. `choice` and `numeric` answer those check kinds; the
 * rest are interaction end states, one shape per kind of expected answer.
 */
export const activityAnswerSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("assignment"), pairs: z.record(answerTextSchema, answerTextSchema) })
    .strict(),
  z.object({ kind: z.literal("choice"), optionId: answerTextSchema }).strict(),
  z
    .object({
      curve: z.enum(["demand", "supply"]),
      direction: z.enum(["left", "right"]),
      kind: z.literal("curveShift"),
    })
    .strict(),
  z.object({ cells: answerIdsSchema, kind: z.literal("grid") }).strict(),
  z
    .object({
      kind: z.literal("links"),
      links: z
        .array(z.object({ from: answerTextSchema, to: answerTextSchema }).strict())
        .max(MAX_ANSWER_ITEMS),
    })
    .strict(),
  z
    .object({
      atoms: z
        .array(z.object({ element: answerTextSchema, id: answerTextSchema }).strict())
        .max(MAX_ANSWER_ITEMS),
      bonds: z
        .array(
          z
            .object({ from: answerTextSchema, order: z.number().int(), to: answerTextSchema })
            .strict(),
        )
        .max(MAX_ANSWER_ITEMS),
      kind: z.literal("molecule"),
    })
    .strict(),
  z.object({ kind: z.literal("notes"), notes: answerIdsSchema }).strict(),
  z.object({ kind: z.literal("numeric"), value: z.number() }).strict(),
  z.object({ ids: answerIdsSchema, kind: z.literal("order") }).strict(),
  z.object({ kind: z.literal("output"), output: answerTextSchema }).strict(),
  z.object({ kind: z.literal("pattern"), pattern: answerTextSchema }).strict(),
  z
    .object({
      deviceDelayMs: z
        .number()
        .min(MIN_DEVICE_DELAY_MS)
        .max(MAX_DEVICE_DELAY_MS)
        .optional()
        .meta({
          description:
            "How late this device plays sound, measured once by tapping along with steady clicks; taps are graded after taking it out",
        }),
      kind: z.literal("rhythm"),
      tapTimesMs: z.array(z.number()).max(MAX_ANSWER_ITEMS),
    })
    .strict(),
  z
    .object({
      columns: answerIdsSchema,
      kind: z.literal("rows"),
      rows: z.array(z.array(cellSchema).max(MAX_ANSWER_ITEMS)).max(MAX_ANSWER_ITEMS),
    })
    .strict(),
  z.object({ ids: answerIdsSchema, kind: z.literal("selection") }).strict(),
  z.object({ kind: z.literal("text"), text: answerTextSchema }).strict(),
]);

export type ActivityAnswer = z.infer<typeof activityAnswerSchema>;

import { z } from "zod";

export const TOPIC_FREQUENCY_LEVELS = ["high", "medium", "low"] as const;

export type TopicFrequencyLevel = (typeof TOPIC_FREQUENCY_LEVELS)[number];

/** `board` is who ran the editions a past-paper lookup counted, when it said. */
export const pastQuestionsSchema = z.object({
  board: z.string().nullable().optional(),
  checkedAt: z.iso.datetime(),
  edition: z.string().nullable(),
  source: z.object({ title: z.string().nullable(), url: z.string() }).nullable(),
  subjects: z.array(z.object({ name: z.string(), questions: z.number().int().min(0) })),
});

export const pastOptionsSchema = z.object({
  board: z.string().nullable().optional(),
  checkedAt: z.iso.datetime(),
  edition: z.string().nullable(),
  options: z.number().int().min(2).nullable(),
  source: z.object({ title: z.string().nullable(), url: z.string() }).nullable(),
});

const pastTopicSchema = z.object({
  appearances: z.number().int().min(0).nullable(),
  level: z.enum(TOPIC_FREQUENCY_LEVELS),
  topic: z.string(),
});

export const pastTopicFrequencySchema = z.object({
  checkedAt: z.iso.datetime().nullable(),
  subjects: z.array(
    z.object({
      basis: z.string(),
      board: z.string().nullable().optional(),
      name: z.string(),
      source: z.object({ title: z.string().nullable(), url: z.string() }),
      topics: z.array(pastTopicSchema),
    }),
  ),
});

export type PastTopicFrequency = z.infer<typeof pastTopicFrequencySchema>;

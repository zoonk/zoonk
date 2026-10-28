import { z } from "zod";

const MEMORY_INSIGHT_KINDS = ["tip", "planChange", "scheduleIdea"] as const;

export type MemoryInsightKindName = (typeof MEMORY_INSIGHT_KINDS)[number];

/** Two short sentences fit on the Today card without truncation in every supported language. */
const MAX_INSIGHT_LENGTH = 240;

const STUDY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export const memoryInsightOutputSchema = z.object({
  kind: z.enum(["none", ...MEMORY_INSIGHT_KINDS]),
  lessonFocus: z.string().nullable(),
  message: z.string().nullable(),
  /** 1-based, from the input list. */
  skill: z.number().int().nullable(),
  studyTime: z.string().nullable(),
});

export type MemoryInsightOutput = z.infer<typeof memoryInsightOutputSchema>;

export type MemoryInsight =
  | { kind: "planChange"; message: string; skillIndex: number; lessonFocus: string }
  | { kind: "scheduleIdea"; message: string; studyTime: string }
  | { kind: "tip"; message: string };

type InsightContext = {
  kinds: readonly MemoryInsightKindName[];
  skillCount: number;
  /** So suggesting the same study time is dropped. */
  studyTime: string | null;
};

function toPlanChange({
  lessonFocus,
  message,
  skill,
  skillCount,
}: MemoryInsightOutput & { message: string; skillCount: number }): MemoryInsight | null {
  const focus = lessonFocus?.trim();

  if (!focus || skill === null || skill < 1 || skill > skillCount) {
    return null;
  }

  return { kind: "planChange", lessonFocus: focus, message, skillIndex: skill - 1 };
}

function toScheduleIdea({
  current,
  message,
  studyTime,
}: {
  current: string | null;
  message: string;
  studyTime: string | null;
}): MemoryInsight | null {
  if (!studyTime || !STUDY_TIME_PATTERN.test(studyTime) || studyTime === current) {
    return null;
  }

  return { kind: "scheduleIdea", message, studyTime };
}

/** Null when the insight can't be shown. */
export function toMemoryInsight({
  context,
  output,
}: {
  context: InsightContext;
  output: MemoryInsightOutput;
}): MemoryInsight | null {
  const message = output.message?.trim() ?? "";

  if (output.kind === "none" || !context.kinds.includes(output.kind)) {
    return null;
  }

  if (message.length === 0 || message.length > MAX_INSIGHT_LENGTH) {
    return null;
  }

  if (output.kind === "planChange") {
    return toPlanChange({ ...output, message, skillCount: context.skillCount });
  }

  if (output.kind === "scheduleIdea") {
    return toScheduleIdea({ current: context.studyTime, message, studyTime: output.studyTime });
  }

  return { kind: "tip", message };
}

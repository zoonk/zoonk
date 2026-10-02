import "server-only";
import { type GoalUnderstanding } from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { z } from "zod";
import { ownLevelSchema } from "../../../learner/placement/placement-contract";
import { ONBOARDING_PURPOSES } from "../onboarding-contract";

const understoodGoalSchema = z.object({
  examName: z.string().optional(),
  examYear: z.number().optional(),
  institution: z.string().optional(),
  kind: z.enum(["learn", "exam", "language"]),
  level: z.string().optional(),
  nativeLanguage: z.string().optional(),
  ownLevel: ownLevelSchema.optional(),
  purpose: z.enum(ONBOARDING_PURPOSES).optional(),
  reason: z.string().optional(),
  role: z.string().optional(),
  subject: z.string(),
  targetCourse: z.string().optional(),
  targetDate: z.string().optional(),
  targetLanguage: z.string().optional(),
  targetPosition: z.string().optional(),
  targetScore: z.string().optional(),
  title: z.string(),
});

/** Stored results are read back through the same shape the task returns, so old rows can't leak in. */
const storedUnderstandingSchema = z.discriminatedUnion("route", [
  z.object({ question: z.string(), route: z.literal("explain") }),
  z.object({ instrument: z.string(), route: z.literal("instrument") }),
  z.object({ route: z.enum(["unclear", "unsafe"]) }),
  z.object({
    dailyMinutes: z.number().optional(),
    followUps: z.array(z.string()),
    goals: z.array(understoodGoalSchema).min(1),
    route: z.literal("goals"),
    studyDays: z.array(z.number()).optional(),
    studyTime: z.string().optional(),
    studyTimeNote: z.string().optional(),
  }),
]) satisfies z.ZodType<GoalUnderstanding>;

type CacheKey = { language: string; normalizedPrompt: string };

/** The understanding of these exact words from the last day, when there is one. */
export async function findCachedUnderstanding({
  language,
  now,
  normalizedPrompt,
}: CacheKey & { now: Date }): Promise<GoalUnderstanding | null> {
  const row = await prisma.goalUnderstanding.findUnique({
    where: { languageNormalizedPrompt: { language, normalizedPrompt } },
  });

  // Relative dates ("this year", "in 6 months") resolve against the day: reuse lasts a day.
  if (!row || now.getTime() - row.generatedAt.getTime() > MS_PER_DAY) {
    return null;
  }

  const parsed = storedUnderstandingSchema.safeParse(row.result);
  return parsed.success ? parsed.data : null;
}

/** Stores what the task understood with the run that wrote it, fresh from now. */
export async function saveUnderstanding({
  language,
  normalizedPrompt,
  provenance,
  result,
}: CacheKey & {
  provenance: { model: string; promptVersion: string; runId: string };
  result: GoalUnderstanding;
}) {
  const { model, promptVersion, runId } = provenance;
  const data = { generatedAt: new Date(), model, promptVersion, result, runId };

  await prisma.goalUnderstanding.upsert({
    create: { ...data, language, normalizedPrompt },
    update: data,
    where: { languageNormalizedPrompt: { language, normalizedPrompt } },
  });
}

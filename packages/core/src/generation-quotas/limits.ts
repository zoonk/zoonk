import {
  type GenerationQuotaPeriod,
  type GenerationQuotaResource,
  type GenerationQuotaViewer,
} from "./contract";

type PeriodLimits = Partial<Record<GenerationQuotaPeriod, number>>;
type ResourceLimits = Record<GenerationQuotaResource, PeriodLimits>;
type GenerationQuotaRule = { limit: number; period: GenerationQuotaPeriod; periodStart: Date };

const LESSON_GENERATION_LIMITS: Record<GenerationQuotaViewer, PeriodLimits> = {
  authenticated: { day: 50, month: 300 },
  guest: { day: 20 },
  subscriber: { day: 400, month: 5000 },
};

const GENERATION_LIMITS: Record<GenerationQuotaViewer, ResourceLimits> = {
  authenticated: {
    chapter: { day: 50 },
    course: { day: 5, month: 10 },
    lesson: LESSON_GENERATION_LIMITS.authenticated,
    lessonQuestion: LESSON_GENERATION_LIMITS.authenticated,
  },
  guest: {
    chapter: { day: 50 },
    course: { day: 3, month: 10 },
    lesson: LESSON_GENERATION_LIMITS.guest,
    lessonQuestion: LESSON_GENERATION_LIMITS.guest,
  },
  subscriber: {
    chapter: { day: 50 },
    course: { day: 20, month: 60 },
    lesson: LESSON_GENERATION_LIMITS.subscriber,
    lessonQuestion: LESSON_GENERATION_LIMITS.subscriber,
  },
};

const QUOTA_PERIODS = ["day", "month"] as const;

/** Uses UTC calendar boundaries so every API region increments the same daily and monthly buckets. */
function getGenerationQuotaPeriodStart({
  now,
  period,
}: {
  now: Date;
  period: GenerationQuotaPeriod;
}): Date {
  if (period === "day") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Omits unsupported periods instead of inventing a monthly limit for resources that only have a daily cap. */
function getGenerationQuotaRule({
  limits,
  now,
  period,
}: {
  limits: PeriodLimits;
  now: Date;
  period: GenerationQuotaPeriod;
}): GenerationQuotaRule[] {
  const limit = limits[period];

  if (limit === undefined) {
    return [];
  }

  return [{ limit, period, periodStart: getGenerationQuotaPeriodStart({ now, period }) }];
}

/** Resolves the exact counters one generation must increment for the viewer's current entitlement. */
export function getGenerationQuotaRules({
  now,
  resource,
  viewer,
}: {
  now: Date;
  resource: GenerationQuotaResource;
  viewer: GenerationQuotaViewer;
}): GenerationQuotaRule[] {
  const limits = GENERATION_LIMITS[viewer][resource];

  return QUOTA_PERIODS.flatMap((period) => getGenerationQuotaRule({ limits, now, period }));
}

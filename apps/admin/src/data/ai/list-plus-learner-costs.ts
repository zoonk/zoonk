import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { getStripePrices } from "@zoonk/auth/stripe-prices";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { PLUS_PLAN } from "@zoonk/utils/subscription";
import { getAiSpendMonthStart } from "./_utils/ai-spend-since";

const CENTS_PER_DOLLAR = 100;
const MONTHS_PER_YEAR = 12;

/** A learner's goals that cost the most this month, shown beside them. */
const GOALS_PER_LEARNER = 3;

/**
 * How a Plus learner pays: `monthly` and `yearly` pay their plan's price, `trial` pays nothing
 * yet, and `granted` is Plus given by support, which nobody pays for.
 */
export type PlusBilling = "granted" | "monthly" | "trial" | "yearly";

type PlusLearnerRow = {
  billing_interval: string | null;
  calls: bigint;
  cost_usd: number | null;
  id: string;
  provider: string;
  status: string;
};

type GoalCostRow = { cost_usd: number | null; goal_id: string; user_id: string };

function toBilling(row: PlusLearnerRow): PlusBilling {
  if (row.status === "trialing") {
    return "trial";
  }

  if (row.provider === "zoonk") {
    return "granted";
  }

  return row.billing_interval === "year" ? "yearly" : "monthly";
}

/**
 * What each plan pays a month in US dollars, from Stripe's list prices (a yearly plan's divided by
 * twelve), before store fees and local prices. Null when Stripe can't be read.
 */
async function loadMonthlyPrices(): Promise<Record<PlusBilling, number> | null> {
  const { data } = await safeAsync(() =>
    getStripePrices([PLUS_PLAN.lookupKey, PLUS_PLAN.annualLookupKey], "usd"),
  );

  const monthly = data?.get(PLUS_PLAN.lookupKey);
  const yearly = data?.get(PLUS_PLAN.annualLookupKey);

  if (!monthly || !yearly) {
    return null;
  }

  return {
    granted: 0,
    monthly: monthly.amount / CENTS_PER_DOLLAR,
    trial: 0,
    yearly: yearly.amount / CENTS_PER_DOLLAR / MONTHS_PER_YEAR,
  };
}

/**
 * Every learner with Plus now and what their AI calls cost since the month began (UTC, as usage
 * limits count), shared Library content they caused included, beside what their plan pays a
 * month and the goals that cost the most, most expensive learner first. Plus is the newest active
 * or trialing paid subscription, as entitlements read it.
 */
export const listPlusLearnerCosts = cacheAdminData(async () => {
  const since = await getAiSpendMonthStart();

  const [rows, prices] = await Promise.all([
    prisma.$queryRaw<PlusLearnerRow[]>`
      WITH plus AS (
        SELECT DISTINCT ON (reference_id)
          reference_id AS id, billing_interval, provider, status
        FROM subscriptions
        WHERE plan != 'free'
          AND status IN ('active', 'trialing')
          AND (provider != 'apple' OR (ended_at IS NULL AND period_end > NOW()))
        ORDER BY reference_id, id DESC
      )
      SELECT plus.id, plus.billing_interval, plus.provider, plus.status,
        COUNT(ai_calls.id) AS calls, SUM(ai_calls.cost_usd) AS cost_usd
      FROM plus
      LEFT JOIN ai_calls ON ai_calls.user_id = plus.id AND ai_calls.created_at >= ${since}
      GROUP BY plus.id, plus.billing_interval, plus.provider, plus.status
      ORDER BY SUM(ai_calls.cost_usd) DESC NULLS LAST, plus.id
    `,
    loadMonthlyPrices(),
  ]);

  const userIds = rows.map((row) => row.id);

  const [users, goalCosts] = await Promise.all([
    prisma.user.findMany({
      select: { email: true, id: true, name: true },
      where: { id: { in: userIds } },
    }),
    prisma.$queryRaw<GoalCostRow[]>`
      SELECT user_id, goal_id, SUM(cost_usd) AS cost_usd
      FROM ai_calls
      WHERE created_at >= ${since} AND goal_id IS NOT NULL AND user_id = ANY(${userIds}::uuid[])
      GROUP BY user_id, goal_id
      ORDER BY SUM(cost_usd) DESC NULLS LAST
    `,
  ]);

  const goals = await prisma.goal.findMany({
    select: { id: true, kind: true, title: true },
    where: { id: { in: goalCosts.map((row) => row.goal_id) } },
  });

  const usersById = new Map(users.map((user) => [user.id, user]));
  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));

  const goalsOf = (userId: string) =>
    goalCosts
      .filter((row) => row.user_id === userId)
      .slice(0, GOALS_PER_LEARNER)
      .flatMap((row) => {
        const goal = goalsById.get(row.goal_id);
        return goal ? [{ ...goal, costUsd: row.cost_usd ?? 0 }] : [];
      });

  const learners = rows.map((row) => {
    const billing = toBilling(row);

    return {
      billing,
      calls: Number(row.calls),
      costUsd: row.cost_usd ?? 0,
      goals: goalsOf(row.id),
      id: row.id,
      paysUsd: prices ? prices[billing] : null,
      user: usersById.get(row.id) ?? null,
    };
  });

  return { learners, prices, since };
});

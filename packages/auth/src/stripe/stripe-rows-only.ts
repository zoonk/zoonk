import { prisma } from "@zoonk/db";

/**
 * Store subscriptions share Better Auth's subscriptions table, and its Stripe plugin finds a
 * learner's subscription by owner and status alone: a store row that still says active would
 * become the row a website checkout writes into. Its queries see only Stripe's rows.
 */
export const stripeRowsOnly = prisma.$extends({
  query: {
    subscription: {
      $allOperations({ args, query }) {
        if (!("where" in args)) {
          return query(args);
        }

        return query({ ...args, where: { ...args.where, provider: "stripe" } });
      },
    },
  },
});

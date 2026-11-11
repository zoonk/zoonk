import { stripeRowsOnly } from "./stripe/stripe-rows-only";

/**
 * Better Auth's device authorization saves `resources: null` for a login that names no resource,
 * and Prisma refuses null for a list column, so that write leaves the list empty instead. Remove
 * once a release has https://github.com/better-auth/better-auth/issues/11933 fixed.
 */
export const authDatabase = stripeRowsOnly.$extends({
  query: {
    deviceCode: {
      create({ args, query }) {
        const { resources, ...data } = args.data;
        return query({ ...args, data: resources === null ? data : args.data });
      },
    },
  },
});

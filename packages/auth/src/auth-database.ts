import { stripeRowsOnly } from "./stripe/stripe-rows-only";

export const authDatabase = stripeRowsOnly.$extends({
  query: {
    oauthRefreshToken: {
      /**
       * Revoking a refresh token deletes only the access tokens issued with it, so one issued before
       * a rotation would keep working after the CLI logs out or an admin revokes the login. A
       * rotation drops the replaced token's access tokens, which the CLI no longer uses. They go
       * first, so a rotation that fails costs the CLI only a refresh.
       */
      async update({ args, query }) {
        if (args.data.rotatedAt && args.where.id) {
          await stripeRowsOnly.oauthAccessToken.deleteMany({ where: { refreshId: args.where.id } });
        }

        return query(args);
      },
    },
  },
});

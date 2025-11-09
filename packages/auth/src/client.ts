import { stripeClient } from "@better-auth/stripe/client";
import { adminClient, emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const zoonkAuthClient = createAuthClient({
  plugins: [
    adminClient(),
    emailOTPClient(),
    stripeClient({
      subscription: true,
    }),
  ],
});

import { stripeClient } from "@better-auth/stripe/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    stripeClient({
      subscription: true,
    }),
  ],
});

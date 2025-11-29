import { betterAuth } from "better-auth/minimal";
import { baseAuthConfig, baseAuthPlugins } from "./auth";

export const auth = betterAuth({
  ...baseAuthConfig,
  emailAndPassword: { enabled: true },
  plugins: [...baseAuthPlugins],
});

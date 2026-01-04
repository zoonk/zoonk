import { betterAuth } from "better-auth/minimal";
import {
  baseAuthConfig,
  baseAuthPlugins,
  fullPlugins,
  socialProviders,
} from "./config";

export const auth = betterAuth({
  ...baseAuthConfig,
  plugins: [...baseAuthPlugins, ...fullPlugins],
  rateLimit: { enabled: true, storage: "database" },
  socialProviders,
});

import { betterAuth } from "better-auth/minimal";
import { baseAuthConfig, baseAuthPlugins } from "./config";

/** @public */
export const auth = betterAuth({
  ...baseAuthConfig,
  emailAndPassword: {
    enabled: true,
    password: {
      // Use no-op hashing for fast tests (no bcrypt/scrypt overhead)
      hash: async (password) => password,
      verify: async ({ hash, password }) => hash === password,
    },
  },
  plugins: [...baseAuthPlugins],
});

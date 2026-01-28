import { createAuthClient } from "better-auth/react";
import { baseClientConfig } from "./client";

// E2E client without baseURL - uses current origin
export const authClient = createAuthClient({
  ...baseClientConfig,
});

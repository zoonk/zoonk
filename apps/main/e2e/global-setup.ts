import { mkdir } from "node:fs/promises";
import { request } from "@zoonk/e2e/fixtures";
import { E2E_USERS } from "./seed/users";

const BASE_URL = "http://localhost:3000";
const E2E_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5432/zoonk_e2e";

async function authenticateUser(
  name: string,
  user: { email: string; password: string },
): Promise<void> {
  const context = await request.newContext({ baseURL: BASE_URL });

  const response = await context.post("/api/auth/sign-in/email", {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `Failed to authenticate ${name} (${user.email}): ${response.status()} - ${body}`,
    );
  }

  await context.storageState({ path: `e2e/.auth/${name}.json` });
  await context.dispose();
}

export default async function globalSetup(): Promise<void> {
  // Set E2E database URL before importing seed (which imports @zoonk/db)
  process.env.DATABASE_URL = E2E_DATABASE_URL;

  // Dynamic import to ensure env vars are set before @zoonk/db initializes
  const { seedE2EData } = await import("./seed");

  // 1. Seed the database with E2E-specific data
  await seedE2EData();

  // 2. Create .auth directory if it doesn't exist
  await mkdir("e2e/.auth", { recursive: true });

  // 3. Authenticate all users in parallel and save storage state
  await Promise.all(
    Object.entries(E2E_USERS).map(([name, user]) =>
      authenticateUser(name, user),
    ),
  );
}

// biome-ignore lint/performance/noBarrelFile: re-exporting for convenience
export { E2E_USERS, type E2EUserKey } from "./seed/users";

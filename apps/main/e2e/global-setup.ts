import { mkdir } from "node:fs/promises";
import { request } from "@zoonk/e2e/fixtures";

const BASE_URL = "http://localhost:3000";

export const E2E_USERS = {
  logout: {
    email: "e2e-logout@zoonk.test",
    password: "password123",
  },
  noProgress: {
    email: "e2e-new@zoonk.test",
    password: "password123",
  },
  withProgress: {
    email: "e2e-progress@zoonk.test",
    password: "password123",
  },
} as const;

export type E2EUserKey = keyof typeof E2E_USERS;

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
  await mkdir("e2e/.auth", { recursive: true });

  await Promise.all(
    Object.entries(E2E_USERS).map(([name, user]) =>
      authenticateUser(name, user),
    ),
  );
}

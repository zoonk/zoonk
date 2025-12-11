import { randomUUID } from "node:crypto";
import { auth } from "@zoonk/auth/testing";

type UserAttrs = {
  email: string;
  name: string;
  role: "user" | "admin";
  password: string;
};

export function userAttrs(attrs?: Partial<UserAttrs>): UserAttrs {
  return {
    email: attrs?.email || `testuser${randomUUID()}@example.test`,
    name: attrs?.name || "Test User",
    password: attrs?.password || "Testuser123!",
    role: attrs?.role || "user",
    ...attrs,
  };
}

export async function userFixture(attrs?: Partial<UserAttrs>) {
  const params = userAttrs(attrs);
  const result = await auth.api.createUser({ body: params });

  return { ...result.user, password: params.password };
}

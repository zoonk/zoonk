import { auth } from "@zoonk/auth";

type UserAttrs = {
  email: string;
  name: string;
  role: "user" | "admin";
};

export function userAttrs(attrs?: Partial<UserAttrs>): UserAttrs {
  return {
    email: `testuser${Date.now()}@example.test`,
    name: "Test User",
    role: "user",
    ...attrs,
  };
}

export async function userFixture(attrs?: Partial<UserAttrs>) {
  const params = userAttrs(attrs);

  const result = await auth.api.createUser({
    body: { ...params, password: "Testuser123!" },
  });

  return result.user;
}

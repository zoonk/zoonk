import { userFixture } from "@zoonk/testing/fixtures/users";
import { cliTokenFixture, sendStaffAuthorization } from "./cli-tokens";

export function staffRequest({ path, body }: { path: string; body: unknown }) {
  return new Request(`http://localhost${path}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export async function signInStaff() {
  const user = await userFixture({ role: "admin" });
  const { accessToken } = await cliTokenFixture({ user });
  sendStaffAuthorization(`Bearer ${accessToken}`);
  return { accessToken, user };
}

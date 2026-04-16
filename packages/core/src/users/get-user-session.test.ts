import { signInAs } from "@zoonk/testing/fixtures/auth";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, expectTypeOf, test } from "vitest";
import { getSession } from "./get-user-session";

describe(getSession, () => {
  test("returns string ids for the authenticated user and session owner", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const session = await getSession(headers);

    expect(session).not.toBeNull();

    if (!session) {
      throw new Error("Expected an authenticated session");
    }

    expect(session.user.id).toBe(user.id);
    expectTypeOf(session.user.id).toBeString();
    expect(session.session.userId).toBe(user.id);
    expectTypeOf(session.session.userId).toBeString();
  });
});

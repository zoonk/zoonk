import {
  CLI_CLIENT_ID,
  STAFF_PROPOSE_SCOPE,
  STAFF_READ_SCOPE,
} from "@zoonk/auth/cli-login-contract";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import { cliTokenFixture } from "../../../auth/src/_test-utils/cli-tokens";
import { getStaffActor } from "./get-staff-actor";

function sendBearer(token: string) {
  vi.mocked(headers).mockResolvedValue(new Headers({ authorization: `Bearer ${token}` }));
}

describe(getStaffActor, () => {
  it("names the login that tried when its account isn't staff, for the audit log", async () => {
    const learner = await userFixture();
    const { accessToken } = await cliTokenFixture({ user: learner });
    sendBearer(accessToken);

    await expect(getStaffActor()).resolves.toStrictEqual({
      clientId: CLI_CLIENT_ID,
      status: "forbidden",
      userId: learner.id,
    });
  });

  it("tells a staff login approved before it could propose fixes to log in again, and lets it read", async () => {
    const admin = await userFixture({ role: "admin" });

    const { accessToken } = await cliTokenFixture({
      scopes: [STAFF_READ_SCOPE, "offline_access"],
      user: admin,
    });

    sendBearer(accessToken);

    await expect(getStaffActor(STAFF_PROPOSE_SCOPE)).resolves.toStrictEqual({
      clientId: CLI_CLIENT_ID,
      status: "missingScope",
      userId: admin.id,
    });

    await expect(getStaffActor()).resolves.toMatchObject({ status: "ready" });
  });

  it("names no one for a token nothing vouches for", async () => {
    sendBearer("not-a-token");

    await expect(getStaffActor()).resolves.toStrictEqual({ status: "unauthorized" });
  });
});

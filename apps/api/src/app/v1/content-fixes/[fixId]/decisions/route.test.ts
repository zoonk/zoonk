import { randomUUID } from "node:crypto";
import { STAFF_PROPOSE_SCOPE, STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { cliTokenFixture } from "../../../../../../../../packages/auth/src/_test-utils/cli-tokens";
import { sendStaffAuthorization } from "../../../../staff/_test-utils/staff-authorization";
import { POST as decide } from "./route";

function decisionRequest({ body, fixId }: { body: unknown; fixId: string }) {
  return decide(
    new Request(`http://localhost/v1/content-fixes/${fixId}/decisions`, {
      body: JSON.stringify(body),
      method: "POST",
    }),
    { params: Promise.resolve({ fixId }) },
  );
}

describe("POST /v1/content-fixes/{fixId}/decisions", () => {
  it("refuses a CLI login, which can propose fixes but never decide them", async () => {
    const admin = await userFixture({ role: "admin" });

    const { accessToken } = await cliTokenFixture({
      scopes: [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE],
      user: admin,
    });

    sendStaffAuthorization(`Bearer ${accessToken}`);

    const response = await decisionRequest({ body: { decision: "reject" }, fixId: randomUUID() });

    expect(response.status).toBe(401);
  });

  it("refuses an approval without a passkey assertion", async () => {
    sendStaffAuthorization();

    const response = await decisionRequest({ body: { decision: "approve" }, fixId: randomUUID() });

    expect(response.status).toBe(400);
  });
});

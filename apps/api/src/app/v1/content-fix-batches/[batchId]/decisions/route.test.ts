import { randomUUID } from "node:crypto";
import { STAFF_PROPOSE_SCOPE, STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { cliTokenFixture } from "../../../../../../../../packages/auth/src/_test-utils/cli-tokens";
import { sendStaffAuthorization } from "../../../../staff/_test-utils/staff-authorization";
import { POST as decide } from "./route";

function decisionRequest(body: unknown) {
  const batchId = randomUUID();

  return decide(
    new Request(`http://localhost/v1/content-fix-batches/${batchId}/decisions`, {
      body: JSON.stringify(body),
      method: "POST",
    }),
    { params: Promise.resolve({ batchId }) },
  );
}

describe("POST /v1/content-fix-batches/{batchId}/decisions", () => {
  it("refuses a CLI login, which can propose fixes but never decide them", async () => {
    const admin = await userFixture({ role: "admin" });

    const { accessToken } = await cliTokenFixture({
      scopes: [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE],
      user: admin,
    });

    sendStaffAuthorization(`Bearer ${accessToken}`);

    await expect(decisionRequest({ decision: "resume" })).resolves.toHaveProperty("status", 401);
    await expect(decisionRequest({ decision: "reject" })).resolves.toHaveProperty("status", 401);
  });

  it("refuses an approval without a passkey assertion", async () => {
    sendStaffAuthorization();

    await expect(decisionRequest({ decision: "approve" })).resolves.toHaveProperty("status", 400);
  });
});

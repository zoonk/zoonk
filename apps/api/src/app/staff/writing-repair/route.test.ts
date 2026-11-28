import {
  STAFF_PROPOSE_SCOPE,
  STAFF_READ_SCOPE,
  STAFF_REPAIR_SCOPE,
} from "@zoonk/auth/cli-login-contract";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { cliTokenFixture } from "../../../../../../packages/auth/src/_test-utils/cli-tokens";
import { staffRequest } from "../_test-utils/requests";
import { sendStaffAuthorization } from "../_test-utils/staff-authorization";
import { POST as repair } from "./route";

function call(apply: boolean) {
  return repair(
    staffRequest({
      body: { after: "ffffffff-ffff-4fff-8fff-ffffffffffff", apply, phase: "learners" },
      path: "/staff/writing-repair",
    }),
  );
}

describe("staff writing repair authority", () => {
  it("allows a read preview and requires a separately granted scope for an apply", async () => {
    const user = await userFixture({ role: "admin" });

    const [ordinary, privileged] = await Promise.all([
      cliTokenFixture({ scopes: [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE], user }),
      cliTokenFixture({ scopes: [STAFF_READ_SCOPE, STAFF_REPAIR_SCOPE], user }),
    ]);

    sendStaffAuthorization(`Bearer ${ordinary.accessToken}`);
    await expect(call(false)).resolves.toMatchObject({ status: 200 });
    await expect(call(true)).resolves.toMatchObject({ status: 403 });

    sendStaffAuthorization(`Bearer ${privileged.accessToken}`);
    await expect(call(true)).resolves.toMatchObject({ status: 200 });
  });
});

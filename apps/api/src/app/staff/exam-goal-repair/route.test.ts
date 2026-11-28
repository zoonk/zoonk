import {
  STAFF_PROPOSE_SCOPE,
  STAFF_READ_SCOPE,
  STAFF_REPAIR_SCOPE,
} from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { cliTokenFixture } from "../../../../../../packages/auth/src/_test-utils/cli-tokens";
import { staffRequest } from "../_test-utils/requests";
import { sendStaffAuthorization } from "../_test-utils/staff-authorization";
import { POST as repair } from "./route";

function call(body: object) {
  return repair(staffRequest({ body, path: "/staff/exam-goal-repair" }));
}

describe("staff exam goal repair", () => {
  it("previews with a read login and applies only with the repair scope", async () => {
    const [staff, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);
    const goal = await goalFixture({ details: {}, kind: "exam", userId: learner.id });

    const [ordinary, privileged] = await Promise.all([
      cliTokenFixture({ scopes: [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE], user: staff }),
      cliTokenFixture({ scopes: [STAFF_READ_SCOPE, STAFF_REPAIR_SCOPE], user: staff }),
    ]);

    const body = { country: "CA", goalId: goal.id };

    sendStaffAuthorization(`Bearer ${ordinary.accessToken}`);

    const preview = await call(body);
    await expect(preview.json()).resolves.toMatchObject({ status: "preview" });

    const refused = await call({ ...body, apply: true });
    expect(refused.status).toBe(403);

    await expect(refused.json()).resolves.toMatchObject({
      error: { code: "REPAIR_SCOPE_REQUIRED" },
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      contentCountry: null,
    });

    sendStaffAuthorization(`Bearer ${privileged.accessToken}`);

    const applied = await call({ ...body, apply: true });
    await expect(applied.json()).resolves.toMatchObject({ after: { contentCountry: "CA" } });
  });

  it("refuses a learner's login, an unknown country and two answers at once", async () => {
    const learner = await userFixture();
    const goal = await goalFixture({ kind: "exam", userId: learner.id });
    const { accessToken } = await cliTokenFixture({ user: learner });

    sendStaffAuthorization(`Bearer ${accessToken}`);
    await expect(call({ country: "CA", goalId: goal.id })).resolves.toMatchObject({ status: 403 });

    const { accessToken: staffToken } = await cliTokenFixture({
      user: await userFixture({ role: "admin" }),
    });

    sendStaffAuthorization(`Bearer ${staffToken}`);
    await expect(call({ country: "XX", goalId: goal.id })).resolves.toMatchObject({ status: 400 });

    await expect(
      call({
        choice: { group: "Discipline", subjects: ["Civil"] },
        country: "CA",
        goalId: goal.id,
      }),
    ).resolves.toMatchObject({ status: 400 });
  });
});

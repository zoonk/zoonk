import { STAFF_PROPOSE_SCOPE, STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { cliTokenFixture } from "../../../../../../../packages/auth/src/_test-utils/cli-tokens";
import { staffRequest } from "../../_test-utils/requests";
import { sendStaffAuthorization } from "../../_test-utils/staff-authorization";
import { POST as proposeFix } from "../route";
import { POST as withdrawFix } from "./route";

async function signInStaff(): Promise<string> {
  const user = await userFixture({ role: "admin" });

  const { accessToken } = await cliTokenFixture({
    scopes: [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE],
    user,
  });

  const authorization = `Bearer ${accessToken}`;
  sendStaffAuthorization(authorization);
  return authorization;
}

function withdraw(body: unknown) {
  return withdrawFix(staffRequest({ body, path: "/staff/content-fixes/withdraw" }));
}

describe("POST /staff/content-fixes/withdraw", () => {
  it("withdraws the proposer's fix, and answers others and a fix past review with why", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });
    const proposer = await signInStaff();

    const proposed = await proposeFix(
      staffRequest({
        body: {
          changes: [{ id: lesson.id, model: "Lesson", set: { title: "Fixed" } }],
          reason: "Typo.",
        },
        path: "/staff/content-fixes",
      }),
    );

    const { batchId } = await proposed.json();

    await signInStaff();
    const someoneElse = await withdraw({ batchId });

    expect(someoneElse.status).toBe(403);

    await expect(someoneElse.json()).resolves.toMatchObject({
      error: { code: "NOT_PROPOSER", message: expect.stringContaining("reject it in Admin") },
    });

    const [fix] = await prisma.contentFix.findMany({ where: { batchId } });
    sendStaffAuthorization(proposer);

    const withdrawn = await withdraw({ batchId });

    expect(withdrawn.status).toBe(200);

    await expect(withdrawn.json()).resolves.toStrictEqual({
      batchId,
      fixes: [{ id: fix?.id, status: "withdrawn" }],
      withdrawn: 1,
    });

    await prisma.contentFix.update({ data: { status: "applied" }, where: { id: fix?.id } });

    await expect(withdraw({ fixId: fix?.id })).resolves.toHaveProperty("status", 409);
  });
});

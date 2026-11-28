import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { signInStaff, staffRequest } from "../_test-utils/requests";
import { sendStaffAuthorization } from "../_test-utils/staff-authorization";
import { POST as audit } from "./route";

const page = { after: "ffffffff-ffff-4fff-8fff-ffffffffffff", kind: "words" };

function call(body: unknown = page) {
  return audit(staffRequest({ body, path: "/staff/audit-clips" }));
}

describe("staff clip audit authority", () => {
  it("requires the staff role and accepts an ordinary staff read login", async () => {
    sendStaffAuthorization();
    await expect(call()).resolves.toMatchObject({ status: 401 });

    const { user } = await signInStaff();
    const response = await call();

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toStrictEqual({
      entries: [],
      fixes: [],
      flagged: 0,
      listened: 0,
      next: null,
      skipped: 0,
      unchecked: 0,
    });

    await prisma.user.update({ data: { role: null }, where: { id: user.id } });
    await expect(call()).resolves.toMatchObject({ status: 403 });
  });

  it.each([
    { limit: 0 },
    { limit: 251 },
    { after: "wrong cursor" },
    { kind: "listening" },
    { voicedBefore: "yesterday" },
    { url: "https://example.test/clip.mp3" },
  ])("refuses an invalid page or caller-supplied URL (%j)", async (overrides) => {
    await signInStaff();
    await expect(call({ ...page, ...overrides })).resolves.toMatchObject({ status: 400 });
  });
});

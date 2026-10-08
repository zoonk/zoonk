import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createBearerLearner, createGuest } from "./helpers/bearer";
import { TEEN_BIRTH, createGuardianInvite } from "./helpers/guardian";

test.describe("Guardians API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("lets a teen invite a guardian and only adults are refused", async () => {
    const [teen, adult] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "guardian-teen" }),
      createBearerLearner({ baseURL, prefix: "guardian-adult" }),
    ]);

    await teen.api.patch("/v1/me/learning-profile", { data: { birth: TEEN_BIRTH } });

    const invite = await teen.api.post("/v1/me/guardian-links", {
      data: { email: "e2e-parent@zoonk.test" },
    });

    expect(invite.status()).toBe(201);

    await expect(invite.json()).resolves.toMatchObject({
      link: { guardianEmail: "e2e-parent@zoonk.test", status: "pending" },
    });

    const list = await teen.api.get("/v1/me/guardian-links");
    await expect(list.json()).resolves.toMatchObject({ links: [{ status: "pending" }] });

    const refused = await adult.api.post("/v1/me/guardian-links", {
      data: { email: "e2e-parent@zoonk.test" },
    });

    expect(refused.status()).toBe(403);

    await expect(refused.json()).resolves.toMatchObject({
      error: { code: "GUARDIAN_NOT_AVAILABLE" },
    });

    await Promise.all([teen.api.dispose(), adult.api.dispose()]);
  });

  test("puts the guardian invite offer away for a learner, never for a guest", async () => {
    const [teen, { guestApi }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "guardian-not-now" }),
      createGuest(baseURL),
    ]);

    await teen.api.patch("/v1/me/learning-profile", { data: { birth: TEEN_BIRTH } });

    const [dismissed, again, guest] = await Promise.all([
      teen.api.post("/v1/me/guardian-invite-dismissals"),
      teen.api.post("/v1/me/guardian-invite-dismissals"),
      guestApi.post("/v1/me/guardian-invite-dismissals"),
    ]);

    expect([dismissed.status(), again.status(), guest.status()]).toStrictEqual([204, 204, 401]);

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: teen.userId } }),
    ).resolves.toMatchObject({ guardianInviteDismissedAt: expect.any(Date) });

    await Promise.all([teen.api.dispose(), guestApi.dispose()]);
  });

  test("runs the guardian flow: accept, see the week, limit time and approve Plus", async () => {
    const [teen, guardian] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "flow-teen" }),
      createBearerLearner({ baseURL, prefix: "flow-guardian" }),
    ]);

    await teen.api.patch("/v1/me/learning-profile", { data: { birth: TEEN_BIRTH } });

    const guardianUser = await prisma.user.update({
      data: { emailVerified: true },
      where: { id: guardian.userId },
    });

    const token = await createGuardianInvite({
      guardianEmail: guardianUser.email,
      teenId: teen.userId,
    });

    const accepted = await guardian.api.post("/v1/me/guardian-invite-acceptances", {
      data: { token },
    });

    expect(accepted.status()).toBe(200);
    const { linkId } = await accepted.json();

    const learners = await guardian.api.get("/v1/me/guarded-learners");
    const { learners: list } = await learners.json();

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ linkId, weeklyActivity: { minutes: 0 } });
    expect(list[0].weeklyActivity.days).toHaveLength(7);

    const [limit, approval] = await Promise.all([
      guardian.api.patch(`/v1/me/guarded-learners/${linkId}`, { data: { dailyLimitMinutes: 45 } }),
      guardian.api.post(`/v1/me/guarded-learners/${linkId}/plus-approval`),
    ]);

    expect([limit.status(), approval.status()]).toStrictEqual([204, 204]);

    const [timeLimit, profile] = await Promise.all([
      teen.api.get("/v1/me/daily-time-limit"),
      teen.api.get("/v1/me/learning-profile"),
    ]);

    await expect(timeLimit.json()).resolves.toMatchObject({ limitMinutes: 45, reached: false });

    await expect(profile.json()).resolves.toMatchObject({
      protections: { plusPurchase: "allowed" },
    });

    const teenRevoke = await teen.api.delete(`/v1/me/guardian-links/${linkId}`);
    expect(teenRevoke.status()).toBe(404);

    const guardianRevoke = await guardian.api.delete(`/v1/me/guardian-links/${linkId}`);
    expect(guardianRevoke.status()).toBe(204);

    await Promise.all([teen.api.dispose(), guardian.api.dispose()]);
  });

  test("lets a guardian keep a teen's memory off, and the teen sees who did", async () => {
    const [teen, guardian] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "memory-teen" }),
      createBearerLearner({ baseURL, prefix: "memory-guardian" }),
    ]);

    await teen.api.patch("/v1/me/learning-profile", { data: { birth: TEEN_BIRTH } });

    // Memory starts off for a teen, and they turn it on themselves.
    const startsOff = await teen.api.get("/v1/me/memory");
    await expect(startsOff.json()).resolves.toMatchObject({ enabled: false, offByGuardian: false });

    await teen.api.patch("/v1/me/memory", { data: { enabled: true } });

    const guardianUser = await prisma.user.update({
      data: { emailVerified: true },
      where: { id: guardian.userId },
    });

    const token = await createGuardianInvite({
      guardianEmail: guardianUser.email,
      teenId: teen.userId,
    });

    const accepted = await guardian.api.post("/v1/me/guardian-invite-acceptances", {
      data: { token },
    });

    const { linkId } = await accepted.json();

    const [empty, off] = await Promise.all([
      guardian.api.patch(`/v1/me/guarded-learners/${linkId}`, { data: {} }),
      guardian.api.patch(`/v1/me/guarded-learners/${linkId}`, { data: { memoryOff: true } }),
    ]);

    expect([empty.status(), off.status()]).toStrictEqual([400, 204]);

    const guarded = await guardian.api.get("/v1/me/guarded-learners");

    await expect(guarded.json()).resolves.toMatchObject({
      learners: [{ linkId, memoryEnabled: false, memoryOff: true }],
    });

    const [memory, turnOn, links] = await Promise.all([
      teen.api.get("/v1/me/memory"),
      teen.api.patch("/v1/me/memory", { data: { enabled: true } }),
      teen.api.get("/v1/me/guardian-links"),
    ]);

    await expect(memory.json()).resolves.toMatchObject({ enabled: false, offByGuardian: true });
    await expect(turnOn.json()).resolves.toStrictEqual({ enabled: false });
    await expect(links.json()).resolves.toMatchObject({ links: [{ id: linkId, memoryOff: true }] });

    await guardian.api.patch(`/v1/me/guarded-learners/${linkId}`, { data: { memoryOff: false } });

    const allowed = await teen.api.get("/v1/me/memory");
    await expect(allowed.json()).resolves.toMatchObject({ enabled: true, offByGuardian: false });

    await Promise.all([teen.api.dispose(), guardian.api.dispose()]);
  });

  test("refuses an invite accepted from another account", async () => {
    const [teen, stranger] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "wrong-teen" }),
      createBearerLearner({ baseURL, prefix: "wrong-stranger" }),
    ]);

    await prisma.user.update({ data: { emailVerified: true }, where: { id: stranger.userId } });

    const token = await createGuardianInvite({
      guardianEmail: "e2e-real-parent@zoonk.test",
      teenId: teen.userId,
    });

    const response = await stranger.api.post("/v1/me/guardian-invite-acceptances", {
      data: { token },
    });

    expect(response.status()).toBe(403);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "GUARDIAN_EMAIL_MISMATCH" },
    });

    await Promise.all([teen.api.dispose(), stranger.api.dispose()]);
  });

  test("lets a teen ask an active guardian to approve Plus, and only then", async () => {
    const [teen, adult, guardian, anonymous, guest] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "approval-teen" }),
      createBearerLearner({ baseURL, prefix: "approval-adult" }),
      createBearerLearner({ baseURL, prefix: "approval-guardian" }),
      request.newContext({ baseURL }),
      createGuest(baseURL),
    ]);

    const path = "/v1/me/plus-approval-requests";

    await teen.api.patch("/v1/me/learning-profile", { data: { birth: TEEN_BIRTH } });

    const [unauthorized, accountRequired, notNeeded, noGuardian] = await Promise.all([
      anonymous.post(path),
      guest.guestApi.post(path),
      adult.api.post(path),
      teen.api.post(path),
    ]);

    expect(unauthorized.status()).toBe(401);

    // Like inviting a guardian: a guest is signed in, but needs an account first.
    expect(accountRequired.status()).toBe(403);

    await expect(accountRequired.json()).resolves.toMatchObject({
      error: { code: "ACCOUNT_REQUIRED" },
    });

    expect(notNeeded.status()).toBe(409);

    await expect(notNeeded.json()).resolves.toMatchObject({
      error: { code: "PLUS_APPROVAL_NOT_NEEDED" },
    });

    expect(noGuardian.status()).toBe(422);
    await expect(noGuardian.json()).resolves.toMatchObject({ error: { code: "NO_GUARDIAN" } });

    const guardianUser = await prisma.user.update({
      data: { emailVerified: true },
      where: { id: guardian.userId },
    });

    const token = await createGuardianInvite({
      guardianEmail: guardianUser.email,
      teenId: teen.userId,
    });

    // An invite nobody accepted yet can't approve anything.
    const pending = await teen.api.post(path);
    expect(pending.status()).toBe(422);

    const accepted = await guardian.api.post("/v1/me/guardian-invite-acceptances", {
      data: { token },
    });

    expect(accepted.status()).toBe(200);
    const { linkId } = await accepted.json();

    // Guardians are emailed; E2E servers send no email, so the accepted request is what shows.
    const requested = await teen.api.post(path);
    expect(requested.status()).toBe(202);

    const approval = await guardian.api.post(`/v1/me/guarded-learners/${linkId}/plus-approval`);
    expect(approval.status()).toBe(204);

    const afterApproval = await teen.api.post(path);
    expect(afterApproval.status()).toBe(409);

    await Promise.all([
      teen.api.dispose(),
      adult.api.dispose(),
      guardian.api.dispose(),
      anonymous.dispose(),
      guest.guestApi.dispose(),
    ]);
  });
});

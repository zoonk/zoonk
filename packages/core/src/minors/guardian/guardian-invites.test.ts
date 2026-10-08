import { prisma } from "@zoonk/db";
import { sendEmail } from "@zoonk/mailer";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { acceptGuardianInvite } from "./accept-guardian-invite";
import { inviteGuardian } from "./invite-guardian";
import { listGuardianLinks } from "./list-guardian-links";
import { revokeGuardianLink } from "./revoke-guardian-link";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => {} })),
  headers: vi.fn(async () => new Headers({ "accept-language": "pt-BR" })),
}));

/** Email delivery is an external provider; the test reads the message instead of sending it. */
vi.mock("@zoonk/mailer", () => ({ sendEmail: vi.fn() }));

const TEEN_BIRTH = { birthMonth: 1, birthYear: new Date().getUTCFullYear() - 15 };

async function createTeen() {
  const teen = await userFixture({ name: "Ana <b>" });
  await learningProfileFixture({ ...TEEN_BIRTH, userId: teen.id });
  return teen;
}

async function createGuardian() {
  const guardian = await userFixture();
  await prisma.user.update({ data: { emailVerified: true }, where: { id: guardian.id } });
  return guardian;
}

/** Reads the token from the invite the teen's guardian received. */
function getSentToken(): string {
  const email = vi.mocked(sendEmail).mock.lastCall?.[0];
  const url = email?.textBody?.match(/https?:\/\/\S+/u)?.[0];
  const token = url ? new URL(url).searchParams.get("token") : null;

  if (!token) {
    throw new Error("Expected an invite email with a token link");
  }

  return token;
}

async function inviteAs({ email, teenId }: { email: string; teenId: string }) {
  mockSession(teenId);
  return inviteGuardian({ email });
}

describe("guardian invites", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockResolvedValue({ data: new Response(), error: null });
  });

  it("lets only learners under 18 with an account invite a guardian", async () => {
    const [adult, unknownAge] = await Promise.all([userFixture(), userFixture()]);
    await learningProfileFixture({ birthMonth: 1, birthYear: 1990, userId: adult.id });

    await expect(inviteAs({ email: "a@example.test", teenId: adult.id })).resolves.toStrictEqual({
      status: "notMinor",
    });

    await expect(
      inviteAs({ email: "a@example.test", teenId: unknownAge.id }),
    ).resolves.toStrictEqual({ status: "notMinor" });

    await prisma.user.update({ data: { isAnonymous: true }, where: { id: unknownAge.id } });

    await expect(
      inviteAs({ email: "a@example.test", teenId: unknownAge.id }),
    ).resolves.toStrictEqual({ status: "accountRequired" });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("emails the guardian a link whose token is stored only as a hash", async () => {
    const [teen, guardian] = await Promise.all([createTeen(), createGuardian()]);

    const result = await inviteAs({ email: guardian.email.toUpperCase(), teenId: teen.id });

    expect(result).toMatchObject({
      link: { guardianEmail: guardian.email, status: "pending" },
      status: "invited",
    });

    const email = vi.mocked(sendEmail).mock.lastCall?.[0];
    const token = getSentToken();

    expect(email).toMatchObject({ to: guardian.email });
    expect(email?.subject).toContain("Ana <b>");
    expect(email?.htmlBody).toContain("Ana &lt;b&gt;");
    expect(email?.textBody).toContain("/auth/guardian?token=");

    const stored = await prisma.guardianLink.findFirstOrThrow({ where: { userId: teen.id } });
    expect(stored.tokenHash).not.toBe(token);
  });

  it("replaces a pending invite and caps invites at five a day", async () => {
    const teen = await createTeen();

    await inviteAs({ email: "first@example.test", teenId: teen.id });
    await inviteAs({ email: "second@example.test", teenId: teen.id });

    await expect(listGuardianLinks()).resolves.toMatchObject([
      { guardianEmail: "second@example.test", status: "pending" },
    ]);

    await Promise.all(
      ["c", "d", "e"].map((name) => inviteAs({ email: `${name}@example.test`, teenId: teen.id })),
    );

    await expect(inviteAs({ email: "f@example.test", teenId: teen.id })).resolves.toStrictEqual({
      status: "limitReached",
    });
  });

  it("is accepted only by the invited guardian signed in with a verified email", async () => {
    const [teen, guardian, stranger] = await Promise.all([
      createTeen(),
      createGuardian(),
      createGuardian(),
    ]);

    await inviteAs({ email: guardian.email, teenId: teen.id });
    const token = getSentToken();

    mockSession(stranger.id);

    await expect(acceptGuardianInvite({ token })).resolves.toStrictEqual({
      status: "wrongAccount",
    });

    mockSession(guardian.id);

    await expect(acceptGuardianInvite({ token })).resolves.toMatchObject({
      learnerName: "Ana <b>",
      status: "accepted",
    });

    await expect(acceptGuardianInvite({ token })).resolves.toMatchObject({ status: "accepted" });

    await expect(
      prisma.guardianLink.findFirstOrThrow({ where: { userId: teen.id } }),
    ).resolves.toMatchObject({ acceptedAt: expect.any(Date), status: "active" });
  });

  it("refuses expired invites and unverified guardians", async () => {
    const [teen, guardian] = await Promise.all([createTeen(), createGuardian()]);

    await inviteAs({ email: guardian.email, teenId: teen.id });
    const token = getSentToken();

    await prisma.guardianLink.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
      where: { userId: teen.id },
    });

    mockSession(guardian.id);
    await expect(acceptGuardianInvite({ token })).resolves.toStrictEqual({ status: "expired" });

    await prisma.user.update({ data: { emailVerified: false }, where: { id: guardian.id } });

    await expect(acceptGuardianInvite({ token })).resolves.toStrictEqual({
      status: "emailNotVerified",
    });
  });

  it("lets the learner cancel a pending invite but not remove an active guardian", async () => {
    const [teen, guardian] = await Promise.all([createTeen(), createGuardian()]);

    await inviteAs({ email: guardian.email, teenId: teen.id });
    const pending = await prisma.guardianLink.findFirstOrThrow({ where: { userId: teen.id } });

    await expect(revokeGuardianLink({ linkId: pending.id })).resolves.toStrictEqual({
      status: "revoked",
    });

    await inviteAs({ email: guardian.email, teenId: teen.id });
    const token = getSentToken();

    mockSession(guardian.id);
    const accepted = await acceptGuardianInvite({ token });
    const linkId = accepted.status === "accepted" ? accepted.linkId : "";

    mockSession(teen.id);
    await expect(revokeGuardianLink({ linkId })).resolves.toStrictEqual({ status: "notFound" });

    mockSession(guardian.id);
    await expect(revokeGuardianLink({ linkId })).resolves.toStrictEqual({ status: "revoked" });
  });
});

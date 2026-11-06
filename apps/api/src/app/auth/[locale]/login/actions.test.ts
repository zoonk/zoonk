import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { sendVerificationOTP } from "../../../../../../../packages/auth/src/plugins/otp";
import { sendVerificationOTPAction } from "./actions";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("../../../../../../../packages/auth/src/plugins/otp", () => ({
  sendVerificationOTP: vi.fn(),
}));

vi.mock("@zoonk/auth", async () => {
  const { createRequire } = await import("node:module");
  /** Better Auth belongs to the auth workspace; don't add it to API just for this harness. */
  const authRequire = createRequire(
    new URL("../../../../../../../packages/auth/package.json", import.meta.url),
  );

  const { betterAuth } = await import(authRequire.resolve("better-auth/minimal"));

  const { baseAuthConfig, baseAuthPlugins } =
    await import("../../../../../../../packages/auth/src/server");

  const { botCheckPlugin } =
    await import("../../../../../../../packages/auth/src/plugins/bot-check");

  const { createEmailOTPPlugin } =
    await import("../../../../../../../packages/auth/src/email-otp-plugin");

  return {
    auth: betterAuth({
      ...baseAuthConfig,
      advanced: { ...baseAuthConfig.advanced, disableOriginCheck: false },
      plugins: [...baseAuthPlugins, botCheckPlugin(), createEmailOTPPlugin({ storeOTP: "hashed" })],
      rateLimit: { enabled: true, storage: "database" },
      secret: "web-email-code-action-test-secret",
    }),
  };
});

/** A browser's Server Action post from the login page. */
function browserHeaders() {
  const bytes = randomUUID().replaceAll("-", "");

  return new Headers({
    host: "localhost:9002",
    origin: "http://localhost:9002",
    "x-forwarded-for": `14.${Number.parseInt(bytes.slice(0, 2), 16)}.${Number.parseInt(bytes.slice(2, 4), 16)}.${Number.parseInt(bytes.slice(4, 6), 16)}`,
  });
}

function requestCode(email: string) {
  const formData = new FormData();
  formData.set("email", email);

  return sendVerificationOTPAction({ status: "idle" }, formData);
}

describe(sendVerificationOTPAction, () => {
  it("sends codes within Better Auth's default limit and says so past it", async () => {
    vi.mocked(headers).mockResolvedValue(browserHeaders() as Awaited<ReturnType<typeof headers>>);
    const email = `web-code-${randomUUID()}@example.test`;

    await requestCode(email);
    await requestCode(email);
    await requestCode(email);

    await expect(requestCode(email)).resolves.toStrictEqual({ email, status: "rateLimited" });
    expect(sendVerificationOTP).toHaveBeenCalledTimes(3);
    expect(redirect).toHaveBeenCalledTimes(3);
  });

  it("asks for a valid address when Better Auth rejects one", async () => {
    vi.mocked(headers).mockResolvedValue(browserHeaders() as Awaited<ReturnType<typeof headers>>);

    await expect(requestCode("not-an-email")).resolves.toStrictEqual({
      email: "not-an-email",
      status: "invalidEmail",
    });

    expect(sendVerificationOTP).not.toHaveBeenCalled();
  });
});

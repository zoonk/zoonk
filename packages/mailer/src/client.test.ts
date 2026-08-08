import { afterEach, describe, expect, it, vi } from "vitest";

const otpBody = "<h2>123456</h2>";

/**
 * Imports the mailer after each test sets env vars because the production code
 * used to read MAILER_API_KEY at module load time. Keeping the import isolated
 * makes the regression test prove the missing-key behavior in each environment.
 */
async function getSendEmail() {
  vi.resetModules();

  const { sendEmail } = await import("./client");

  return sendEmail;
}

describe("sendEmail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("captures the email in the local inbox when development disables email sending", async () => {
    vi.stubEnv("MAILER_API_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true }));
    const sendEmail = await getSendEmail();

    const { data, error } = await sendEmail({
      htmlBody: otpBody,
      subject: "Your OTP code",
      to: "user@example.com",
    });

    expect(error).toBeNull();
    expect(data?.ok).toBe(true);

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3202/api/emails", {
      body: JSON.stringify({ htmlBody: otpBody, subject: "Your OTP code", to: "user@example.com" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("captures development email at the configured mailbox URL", async () => {
    vi.stubEnv("MAILBOX_URL", "http://mailbox.zoonk.localhost:1355/api/emails");
    vi.stubEnv("MAILER_API_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true }));
    const sendEmail = await getSendEmail();

    await sendEmail({ htmlBody: otpBody, subject: "Your OTP code", to: "user@example.com" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://mailbox.zoonk.localhost:1355/api/emails",
      expect.any(Object),
    );
  });

  it("allows missing mailer config in e2e without logging the email body", async () => {
    vi.stubEnv("E2E_TESTING", "true");
    vi.stubEnv("MAILER_API_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");

    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const sendEmail = await getSendEmail();

    const { data, error } = await sendEmail({
      htmlBody: otpBody,
      subject: "Your OTP code",
      to: "user@example.com",
    });

    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    expect(JSON.stringify(info.mock.calls)).not.toContain(otpBody);
  });

  it("fails in deployed environments when the mailer api key is missing", async () => {
    vi.stubEnv("MAILER_API_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const sendEmail = await getSendEmail();

    const { data, error } = await sendEmail({
      htmlBody: otpBody,
      subject: "Your OTP code",
      to: "user@example.com",
    });

    expect(data).toBeNull();

    expect(error).toStrictEqual(
      new Error("MAILER_API_KEY is required to send email outside development."),
    );

    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(otpBody);
    expect(JSON.stringify(info.mock.calls)).not.toContain(otpBody);
  });
});

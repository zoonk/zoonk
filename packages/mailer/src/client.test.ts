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

  it("logs the email body when local development disables email sending", async () => {
    vi.stubEnv("MAILER_API_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
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

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Your OTP code",
        textBody: otpBody,
        to: "user@example.com",
      }),
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

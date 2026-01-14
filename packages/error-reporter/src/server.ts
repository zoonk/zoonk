import { sendEmail } from "@zoonk/mailer";

export type ErrorPayload = {
  digest?: string;
  message?: string;
  method?: string;
  name?: string;
  path?: string;
  routeType?: string;
  source: "client" | "server";
  stack?: string;
  timestamp?: string;
  url?: string;
  userAgent?: string;
};

function formatErrorHtml(error: ErrorPayload): string {
  const rows = [
    { label: "Source", value: error.source },
    { label: "Message", value: error.message },
    { label: "Name", value: error.name },
    { label: "URL", value: error.url ?? error.path },
    { label: "Method", value: error.method },
    { label: "Route Type", value: error.routeType },
    { label: "Digest", value: error.digest },
    { label: "User Agent", value: error.userAgent },
    { label: "Timestamp", value: error.timestamp ?? new Date().toISOString() },
  ]
    .filter((row) => row.value)
    .map(
      (row) =>
        `<tr><td><strong>${row.label}</strong></td><td>${row.value}</td></tr>`,
    )
    .join("");

  const stackHtml = error.stack
    ? `<h3>Stack Trace</h3><pre style="background:#f5f5f5;padding:12px;overflow-x:auto;font-size:12px;">${error.stack}</pre>`
    : "";

  return `
    <h2>Error Report</h2>
    <table style="border-collapse:collapse;width:100%;">
      ${rows}
    </table>
    ${stackHtml}
  `;
}

export async function sendErrorEmail(error: ErrorPayload): Promise<void> {
  if (process.env.VERCEL_ENV !== "production") {
    console.info(
      "[Error Reporter] Skipping email (non-production):",
      JSON.stringify(error),
    );
    return;
  }

  const subject = `[${error.source}] ${error.message?.slice(0, 50) ?? "Unknown error"}`;

  await sendEmail({
    subject,
    text: formatErrorHtml(error),
    to: "errors@zoonk.com",
  });
}

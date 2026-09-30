import "server-only";
import { sendEmail } from "@zoonk/mailer";
import { getGuardianInviteEmail, getPlusApprovalRequestEmail } from "@zoonk/mailer/guardian-emails";
import { LOCALE_COOKIE, getLocaleFromRequest } from "@zoonk/utils/locale";
import { API_URL } from "@zoonk/utils/url";
import { cookies, headers } from "next/headers";

/**
 * Guardians accept invites and manage learners on the central auth host, where every client signs
 * in, so links work the same whether the invite came from the web or a native app.
 */
const GUARDIAN_PAGE_PATH = "/auth/guardian";

async function getRequestLocale() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  return getLocaleFromRequest({
    acceptLanguage: headerStore.get("accept-language"),
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
  });
}

function getGuardianPageUrl(token?: string): string {
  const url = new URL(GUARDIAN_PAGE_PATH, API_URL);

  if (token) {
    url.searchParams.set("token", token);
  }

  return url.toString();
}

async function deliver(email: { htmlBody: string; subject: string; textBody: string; to: string }) {
  const { error } = await sendEmail(email);

  if (error) {
    throw error;
  }
}

export async function sendGuardianInvite({
  guardianEmail,
  learnerName,
  token,
}: {
  guardianEmail: string;
  learnerName: string;
  token: string;
}) {
  const email = await getGuardianInviteEmail({
    acceptUrl: getGuardianPageUrl(token),
    learnerName,
    locale: await getRequestLocale(),
  });

  await deliver({ ...email, to: guardianEmail });
}

export async function sendPlusApprovalRequests({
  guardianEmails,
  learnerName,
}: {
  guardianEmails: string[];
  learnerName: string;
}) {
  const email = await getPlusApprovalRequestEmail({
    guardianUrl: getGuardianPageUrl(),
    learnerName,
    locale: await getRequestLocale(),
  });

  await Promise.all(guardianEmails.map((to) => deliver({ ...email, to })));
}

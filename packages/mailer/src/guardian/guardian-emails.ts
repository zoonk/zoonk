import { isValidLocale } from "@zoonk/utils/locale";

const translations = {
  de: () => import("./translations/de.json").then((module) => module.default),
  en: () => import("./translations/en.json").then((module) => module.default),
  es: () => import("./translations/es.json").then((module) => module.default),
  fr: () => import("./translations/fr.json").then((module) => module.default),
  pt: () => import("./translations/pt.json").then((module) => module.default),
};

type GuardianEmail = { htmlBody: string; subject: string; textBody: string };

const HTML_ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

/** The learner's name is their own text, so it's escaped before it goes into the HTML. */
function escapeHtml(value: string): string {
  return value.replaceAll(/["&'<>]/gu, (character) => HTML_ESCAPES[character] ?? character);
}

function getGuardianTranslation(locale: string) {
  return translations[isValidLocale(locale) ? locale : "en"]();
}

function withName(template: string, name: string): string {
  return template.replaceAll("{name}", name);
}

/**
 * The invite a learner under 18 sends to a guardian. The link carries a one-time token; the guardian
 * signs in with the invited address to accept.
 */
export async function getGuardianInviteEmail({
  acceptUrl,
  learnerName,
  locale,
}: {
  acceptUrl: string;
  learnerName: string;
  locale: string;
}): Promise<GuardianEmail> {
  const t = await getGuardianTranslation(locale);
  const html = (template: string) => withName(template, escapeHtml(learnerName));
  const text = (template: string) => withName(template, learnerName);

  return {
    htmlBody: `
      <p>${html(t.inviteIntro)}</p>
      <p>${t.inviteWhatYouCanDo}</p>
      <p><a href="${escapeHtml(acceptUrl)}">${t.inviteAction}</a></p>
      <p>${t.inviteExpiry}</p>
      <p>${html(t.inviteDisclaimer)}</p>
    `,
    subject: text(t.inviteSubject),
    textBody: [
      text(t.inviteIntro),
      t.inviteWhatYouCanDo,
      `${t.inviteAction}: ${acceptUrl}`,
      t.inviteExpiry,
      text(t.inviteDisclaimer),
    ].join("\n\n"),
  };
}

/** Asks an active guardian to approve Plus, since learners under 18 can't subscribe without it. */
export async function getPlusApprovalRequestEmail({
  guardianUrl,
  learnerName,
  locale,
}: {
  guardianUrl: string;
  learnerName: string;
  locale: string;
}): Promise<GuardianEmail> {
  const t = await getGuardianTranslation(locale);

  return {
    htmlBody: `
      <p>${withName(t.plusApprovalIntro, escapeHtml(learnerName))}</p>
      <p><a href="${escapeHtml(guardianUrl)}">${t.plusApprovalAction}</a></p>
    `,
    subject: withName(t.plusApprovalSubject, learnerName),
    textBody: [
      withName(t.plusApprovalIntro, learnerName),
      `${t.plusApprovalAction}: ${guardianUrl}`,
    ].join("\n\n"),
  };
}

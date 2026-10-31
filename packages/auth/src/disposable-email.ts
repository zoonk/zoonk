import mailchecker from "mailchecker";

/**
 * Mailchecker lists some persistent privacy aliases as disposable; these domains and their
 * subdomains stay allowed. Apple: https://developer.apple.com/news/?id=1ptvdtcm
 */
const privacyEmailDomains = new Set([
  "icloud.com",
  "private.icloud.com",
  "privaterelay.appleid.com",
  "duck.com",
  "mozmail.com",
  "relay.firefox.com",
  "simplelogin.com",
  "simplelogin.co",
  "simplelogin.fr",
  "simplelogin.io",
  "aleeas.com",
  "slmail.me",
  "slmails.com",
  "8shield.net",
  "passmail.com",
  "passmail.net",
  "passfwd.com",
  "passinbox.com",
  "addy.io",
  "anonaddy.com",
  "anonaddy.me",
  "33mail.com",
]);

const disposableDomains = mailchecker.blacklist();

export function isDisposableEmail(email: string) {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  const labels = domain.split(".");
  const domains = labels.map((_, index) => labels.slice(index).join("."));

  if (domains.some((candidate) => privacyEmailDomains.has(candidate))) {
    return false;
  }

  return domains.some((candidate) => disposableDomains.has(candidate));
}

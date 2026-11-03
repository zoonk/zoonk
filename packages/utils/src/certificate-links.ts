import { getLanguageName } from "./languages";
import { getSupportedLocaleFromLanguage } from "./locale";
import { hashSeed } from "./seeded-random";
import { MAIN_URL } from "./url";

/** Bump when the certificate's design changes, so shared images aren't served from old caches. */
const CERTIFICATE_DESIGN_VERSION = 1;

const ISSUER = "Zoonk";

const LINKEDIN_ADD_TO_PROFILE_URL = "https://www.linkedin.com/profile/add";

const CODE_GROUP = 4;

const VERSION_RADIX = 36;

export const CERTIFICATE_IMAGE_VARIANTS = ["print", "screen", "link", "post"] as const;

export type CertificateImageVariant = (typeof CERTIFICATE_IMAGE_VARIANTS)[number];

type CertificateLinkInput = {
  code: string;
  completedOn: string;
  language: string;
  level: string | null;
  recipientName: string | null;
  targetLanguage: string | null;
  title: string | null;
};

export type CertificateLinks = {
  imageUrls: Record<CertificateImageVariant, string>;
  linkedInUrl: string;
  path: string;
  url: string;
};

export function formatCertificateCode(code: string): string {
  return code.match(new RegExp(`.{1,${CODE_GROUP}}`, "gu"))?.join("-") ?? code;
}

/** The name is the only thing on a certificate that changes after it's earned. */
function getImageVersion(recipientName: string | null): string {
  return hashSeed(`${CERTIFICATE_DESIGN_VERSION}:${recipientName ?? ""}`).toString(VERSION_RADIX);
}

function getCertificateName(input: CertificateLinkInput): string {
  if (input.title) {
    return input.title;
  }

  const language = input.targetLanguage
    ? getLanguageName({ targetLanguage: input.targetLanguage, userLanguage: input.language })
    : ISSUER;

  return input.level ? `${language} ${input.level}` : language;
}

function getLinkedInUrl({ input, url }: { input: CertificateLinkInput; url: string }): string {
  const [year = "", month = ""] = input.completedOn.split("-");

  const params = new URLSearchParams({
    certId: formatCertificateCode(input.code),
    certUrl: url,
    issueMonth: String(Number(month)),
    issueYear: year,
    name: getCertificateName(input),
    organizationName: ISSUER,
    startTask: "CERTIFICATION_NAME",
  });

  return `${LINKEDIN_ADD_TO_PROFILE_URL}?${params.toString()}`;
}

/**
 * `origin` defaults to `MAIN_URL`, which an app that doesn't set it reads as production. The page
 * path has no locale, so it opens in the visitor's language. Image paths name the
 * certificate's own locale and end in `.png`, so Main's locale middleware leaves them alone and
 * every visitor sees the same picture.
 */
export function getCertificateLinks({
  origin = MAIN_URL,
  ...input
}: CertificateLinkInput & { origin?: string }): CertificateLinks {
  const path = `/c/${formatCertificateCode(input.code)}`;
  const url = new URL(path, origin).toString();
  const locale = getSupportedLocaleFromLanguage(input.language);
  const version = getImageVersion(input.recipientName);

  const imageUrl = (variant: CertificateImageVariant) =>
    new URL(`/${locale}/c/${input.code}/image/${variant}.png?v=${version}`, origin).toString();

  return {
    imageUrls: {
      link: imageUrl("link"),
      post: imageUrl("post"),
      print: imageUrl("print"),
      screen: imageUrl("screen"),
    },
    linkedInUrl: getLinkedInUrl({ input, url }),
    path,
    url,
  };
}

import { getCourseLevelNames } from "./course-level-names";
import { getSupportedLocaleFromLanguage } from "./locale";
import { hashSeed } from "./seeded-random";
import { MAIN_URL } from "./url";

/** Bump when the certificate's design changes, so shared images aren't served from old caches. */
const CERTIFICATE_DESIGN_VERSION = 2;

const ISSUER = "Zoonk";

const LINKEDIN_ADD_TO_PROFILE_URL = "https://www.linkedin.com/profile/add";

const CODE_GROUP = 4;

const VERSION_RADIX = 36;

export const CERTIFICATE_IMAGE_VARIANTS = ["print", "screen", "link", "post"] as const;

export type CertificateImageVariant = (typeof CERTIFICATE_IMAGE_VARIANTS)[number];

type CertificateLinkInput = {
  cefrRange: string | null;
  code: string;
  completedOn: string;
  courseLevel: keyof ReturnType<typeof getCourseLevelNames> | null;
  language: string;
  recipientName: string | null;
  title: string;
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

export function getCertificatePath(code: string): string {
  return `/c/${formatCertificateCode(code)}`;
}

/** The link as printed and shown, without "www.": `zoonk.com/c/<code>` is what a reader types from paper. */
export function getCertificateDisplayUrl(url: string): string {
  const { host, pathname } = new URL(url);
  return `${host.replace(/^www\./u, "")}${pathname}`;
}

/** The name is the only thing on a certificate that changes after it's earned. */
export function getCertificateImageVersion(recipientName: string | null): string {
  return hashSeed(`${CERTIFICATE_DESIGN_VERSION}:${recipientName ?? ""}`).toString(VERSION_RADIX);
}

type NamedLevel = Pick<CertificateLinkInput, "cefrRange" | "language"> & {
  courseLevel: NonNullable<CertificateLinkInput["courseLevel"]>;
};

/** In the certificate's own language: "Beginner", or "Intermediate (B1–B2)" for a language's. */
export function getCertificateLevelName({ cefrRange, courseLevel, language }: NamedLevel): string {
  const level = getCourseLevelNames(language)[courseLevel];
  return cefrRange ? `${level} (${cefrRange})` : level;
}

/** In the certificate's own language: "Python · Beginner", "Italiano · Intermediário (B1–B2)" or "Python". */
export function getCertificateName(
  input: Pick<CertificateLinkInput, "cefrRange" | "courseLevel" | "language" | "title">,
): string {
  const { courseLevel } = input;

  return courseLevel
    ? `${input.title} · ${getCertificateLevelName({ ...input, courseLevel })}`
    : input.title;
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
  const path = getCertificatePath(input.code);
  const url = new URL(path, origin).toString();
  const locale = getSupportedLocaleFromLanguage(input.language);
  const version = getCertificateImageVersion(input.recipientName);

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

import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { type CertificateImageVariant } from "@zoonk/utils/certificate-links";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { ImageResponse } from "next/og";
import { fitLink, fitPost, fitSheet } from "./certificate-fit";
import { getCertificateFonts } from "./certificate-fonts";
import { CERTIFICATE_COLORS } from "./certificate-palette";
import { CertificateLink, CertificatePost } from "./certificate-share";
import { CertificateSheet } from "./certificate-sheet";
import { CERTIFICATE_SIZES, SHEET_SCALES, TEXT } from "./certificate-spec";
import { type CertificateView, getCertificateView } from "./certificate-view";

const LOGO_PATH = join(process.cwd(), "src/app/icon.svg");

const logoSvg = await readFile(LOGO_PATH);
const logoSrc = `data:image/svg+xml;base64,${logoSvg.toString("base64")}`;

type Drawing = { locale: string; logo: string; view: CertificateView };

const DRAWINGS: Record<CertificateImageVariant, (drawing: Drawing) => Promise<React.ReactNode>> = {
  link: async ({ locale, logo, view }) => (
    <CertificateLink fitted={await fitLink({ locale, view })} logo={logo} view={view} />
  ),
  post: async ({ locale, logo, view }) => (
    <CertificatePost fitted={await fitPost({ locale, view })} logo={logo} view={view} />
  ),
  print: async ({ locale, logo, view }) => (
    <CertificateSheet
      fitted={await fitSheet({ locale, scale: SHEET_SCALES.print, view })}
      logo={logo}
      scale={SHEET_SCALES.print}
      view={view}
    />
  ),
  screen: async ({ locale, logo, view }) => (
    <CertificateSheet
      fitted={await fitSheet({ locale, scale: SHEET_SCALES.screen, view })}
      logo={logo}
      scale={SHEET_SCALES.screen}
      view={view}
    />
  ),
};

/**
 * One certificate as a PNG: the print sheet or a share picture. Names and titles, which can be in any
 * script, are shaped by Pango (`shaped-text.ts`); the rest is laid out by Satori.
 */
export async function renderCertificateImage({
  facts,
  variant,
}: {
  facts: CertificateFacts;
  variant: CertificateImageVariant;
}): Promise<ImageResponse> {
  const locale = getSupportedLocaleFromLanguage(facts.language);

  const [view, fonts] = await Promise.all([getCertificateView(facts), getCertificateFonts(locale)]);

  const content = await DRAWINGS[variant]({ locale, logo: logoSrc, view });

  return new ImageResponse(
    <div
      style={{
        color: CERTIFICATE_COLORS.ink,
        display: "flex",
        fontFamily: "Geist",
        height: "100%",
        letterSpacing: "-0.006em",
        lineHeight: TEXT.bodyLineHeight,
        width: "100%",
      }}
    >
      {content}
    </div>,
    { ...CERTIFICATE_SIZES[variant], fonts },
  );
}

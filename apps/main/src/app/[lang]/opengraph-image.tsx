import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_LOCALE, isValidLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { ImageResponse } from "next/og";

const LOGO_PATH = join(process.cwd(), "src/app/icon.svg");

export const alt = "Zoonk";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

/**
 * Reuses the app icon as the social-card mark while swapping its colors for the
 * light-on-dark treatment established by the original static image.
 */
async function getLogoDataUrl(): Promise<string> {
  const icon = await readFile(LOGO_PATH, "utf8");

  const logo = icon
    .replace('fill="#171717"', 'fill="#fafafa"')
    .replace('fill="#fff"', 'fill="#0d1117"');

  return `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;
}

/**
 * Creates one static social card per route locale so unprefixed English pages
 * and explicitly localized pages describe Zoonk in the language being shared.
 */
export default async function OpenGraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : DEFAULT_LOCALE;
  const t = await getExtracted({ locale });
  const logoSrc = await getLogoDataUrl();

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0d1117",
        color: "#fafafa",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, Helvetica, sans-serif",
        height: "100%",
        justifyContent: "center",
        padding: "64px 80px",
        width: "100%",
      }}
    >
      {/* oxlint-disable-next-line next/no-img-element -- ImageResponse renders plain img elements, not next/image. */}
      <img alt="" src={logoSrc} style={{ height: 190, width: 190 }} />

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          marginTop: 48,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 400,
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
          }}
        >
          {t("learn anything with AI.")}
        </div>

        <div
          style={{
            color: "#a7adb7",
            display: "flex",
            fontSize: 30,
            fontWeight: 400,
            lineHeight: 1.25,
          }}
        >
          {t("get an interactive course created for you.")}
        </div>
      </div>
    </div>,
    { ...size },
  );
}

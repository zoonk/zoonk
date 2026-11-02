import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { routing } from "@/i18n/routing";
import { getOpenGraphWordBreak } from "@/lib/metadata/open-graph-word-break";
import { DEFAULT_LOCALE, isValidLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { ImageResponse } from "next/og";
import { type ReactNode } from "react";
import { getHomeHeadline } from "./(home)/_components/home-headline";

const LOGO_PATH = join(process.cwd(), "src/app/icon.svg");

export const alt = "Zoonk";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

/** Cached, so the file read doesn't keep the card from being generated at build time. */
async function getLogoDataUrl(): Promise<string> {
  "use cache";

  const icon = await readFile(LOGO_PATH, "utf8");

  const logo = icon
    .replace('fill="#171717"', 'fill="#fafafa"')
    .replace('fill="#fff"', 'fill="#0d1117"');

  return `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;
}

function renderLine(chunks: ReactNode) {
  return <div style={{ display: "flex", textWrap: "balance" }}>{chunks}</div>;
}

function renderMore(chunks: ReactNode) {
  return <div style={{ color: "#a7adb7", display: "flex", textWrap: "balance" }}>{chunks}</div>;
}

export function generateStaticParams() {
  return routing.locales.map((language) => ({ lang: language }));
}

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
        wordBreak: getOpenGraphWordBreak(locale),
      }}
    >
      {/* oxlint-disable-next-line next/no-img-element -- ImageResponse renders plain img elements, not next/image. */}
      <img alt="" src={logoSrc} style={{ height: 112, width: 112 }} />

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          marginTop: 36,
          textAlign: "center",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            fontSize: 60,
            fontWeight: 400,
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
          }}
        >
          {await getHomeHeadline({ line: renderLine, locale, more: renderMore })}
        </div>

        <div
          style={{
            color: "#a7adb7",
            display: "flex",
            fontSize: 30,
            fontWeight: 400,
            lineHeight: 1.25,
            textWrap: "balance",
          }}
        >
          {t({
            description:
              "The landing's subhead, under a headline listing goals. In Brazilian Portuguese: “Conte seu objetivo e a data. O Zoonk monta um plano para cada dia, do tamanho do seu tempo, começando pelo que você já sabe.”",
            message:
              "Tell Zoonk your goal and the date. It builds a plan for each day that fits your time and starts from what you already know.",
          })}
        </div>
      </div>
    </div>,
    { ...size },
  );
}

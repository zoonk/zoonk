import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { routing } from "@/i18n/routing";
import { getOpenGraphWordBreak } from "@/lib/metadata/open-graph-word-break";
import { DEFAULT_LOCALE, isValidLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { ImageResponse } from "next/og";
import { type ReactNode } from "react";

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
      <img alt="" src={logoSrc} style={{ height: 150, width: 150 }} />

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          marginTop: 40,
          textAlign: "center",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            fontSize: 64,
            fontWeight: 400,
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
          }}
        >
          {t.rich({
            description:
              "The landing's headline: two short sentences, each shown as its own line. Keep it short and punchy. In Brazilian Portuguese: “Pare de decidir o que estudar. Só estude.”",
            message: "<line>Stop deciding what to study.</line> <line>Just study.</line>",
            values: { line: renderLine },
          })}
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
              "The landing's subhead. In Brazilian Portuguese: “Conte sua meta e a data. O Zoonk divide tudo em um plano diário do tamanho do seu tempo.”",
            message:
              "Tell us your goal and the date. Zoonk splits it all into a daily plan sized to your time.",
          })}
        </div>
      </div>
    </div>,
    { ...size },
  );
}

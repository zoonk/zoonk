import { routing } from "@/i18n/routing";
import { FONT_WEIGHTS } from "@/lib/certificates/certificate-fonts";
import { getOpenGraphLogo } from "@/lib/metadata/open-graph-brand";
import { getOpenGraphWordBreak } from "@/lib/metadata/open-graph-word-break";
import { shareCardFonts } from "@/lib/metadata/share-card-fonts";
import { DEFAULT_LOCALE, isValidLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { ImageResponse } from "next/og";
import { type ReactNode } from "react";
import { getHomeHeadline } from "./(home)/_components/home-headline";

export const alt = "Zoonk";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

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

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0d1117",
        color: "#fafafa",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Geist",
        height: "100%",
        justifyContent: "center",
        padding: "64px 80px",
        width: "100%",
        wordBreak: getOpenGraphWordBreak(locale),
      }}
    >
      {/* oxlint-disable-next-line next/no-img-element -- ImageResponse renders plain img elements, not next/image. */}
      <img alt="" src={getOpenGraphLogo("dark")} style={{ height: 112, width: 112 }} />

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
            fontWeight: FONT_WEIGHTS.brand,
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
            description: "The home share card's subhead, under a headline listing goals.",
            message:
              "Tell Zoonk your goal and when you want to be ready. It builds a plan for each day that fits your time and starts from what you already know.",
          })}
        </div>
      </div>
    </div>,
    { ...size, fonts: shareCardFonts },
  );
}

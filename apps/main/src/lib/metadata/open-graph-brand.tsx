import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FONT_WEIGHTS } from "@/lib/certificates/certificate-fonts";

/** Read while the module loads, as `shareCardFonts` are. */
const ICON = await readFile(join(process.cwd(), "src/app/icon.svg"), "utf8");

const BRAND_NAME = "Zoonk";
const NAME_SCALE = 0.8;
const GAP_SCALE = 0.3;

const TONES = {
  dark: { ink: "#fafafa", paper: "#0d1117" },
  light: { ink: "#171717", paper: "#fff" },
} as const;

type Tone = keyof typeof TONES;

export function getOpenGraphLogo(tone: Tone): string {
  const { ink, paper } = TONES[tone];

  const logo = ICON.replace('fill="#171717"', `fill="${ink}"`).replace(
    'fill="#fff"',
    `fill="${paper}"`,
  );

  return `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;
}

/** The logo and the name, as every share card and certificate draws them. */
export function Brand({
  logoSrc,
  scale,
  spec,
}: {
  logoSrc: string;
  scale: number;
  spec: { gap: number; logo: number; size: number };
}) {
  return (
    <div style={{ alignItems: "center", display: "flex", gap: spec.gap * scale }}>
      {/* oxlint-disable-next-line next/no-img-element -- ImageResponse renders plain img elements, not next/image. */}
      <img alt="" height={spec.logo * scale} src={logoSrc} width={spec.logo * scale} />
      <span
        style={{
          fontSize: spec.size * scale,
          fontWeight: FONT_WEIGHTS.brand,
          letterSpacing: "-0.03em",
        }}
      >
        {BRAND_NAME}
      </span>
    </div>
  );
}

/** The brand line that opens every share card that isn't the brand's own. */
export function OpenGraphBrand({ logoSrc, size }: { logoSrc: string; size: number }) {
  return (
    <Brand
      logoSrc={logoSrc}
      scale={1}
      spec={{ gap: size * GAP_SCALE, logo: size, size: size * NAME_SCALE }}
    />
  );
}

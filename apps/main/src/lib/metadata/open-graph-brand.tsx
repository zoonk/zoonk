import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FONT_WEIGHTS } from "@/lib/certificates/certificate-fonts";

const LOGO_PATH = join(process.cwd(), "src/app/icon.svg");

const BRAND_NAME = "Zoonk";
const NAME_SCALE = 0.8;
const GAP_SCALE = 0.3;

const TONES = {
  dark: { ink: "#fafafa", paper: "#0d1117" },
  light: { ink: "#171717", paper: "#fff" },
} as const;

type Tone = keyof typeof TONES;

/** Cached, so the file read doesn't keep a card from being generated at build time. */
export async function getOpenGraphLogo(tone: Tone): Promise<string> {
  "use cache";

  const icon = await readFile(LOGO_PATH, "utf8");
  const { ink, paper } = TONES[tone];

  const logo = icon
    .replace('fill="#171717"', `fill="${ink}"`)
    .replace('fill="#fff"', `fill="${paper}"`);

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

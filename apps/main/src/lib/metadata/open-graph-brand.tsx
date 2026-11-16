import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

/** The logo and the name, as every share card that isn't the brand's own opens. */
export function OpenGraphBrand({ logoSrc, size }: { logoSrc: string; size: number }) {
  return (
    <div style={{ alignItems: "center", display: "flex", gap: size * GAP_SCALE }}>
      {/* oxlint-disable-next-line next/no-img-element -- ImageResponse renders plain img elements, not next/image. */}
      <img alt="" src={logoSrc} style={{ height: size, width: size }} />
      <span style={{ fontSize: size * NAME_SCALE, fontWeight: 700, letterSpacing: "-0.02em" }}>
        {BRAND_NAME}
      </span>
    </div>
  );
}

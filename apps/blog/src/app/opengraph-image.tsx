import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const LOGO_PATH = join(process.cwd(), "src/app/icon.svg");
const HEADLINE_LINES = ["Turn your goal into", "a daily learning plan."];

export const alt = `Zoonk logo above the words: ${HEADLINE_LINES.join(" ")}`;
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

async function getLogoDataUrl(): Promise<string> {
  const icon = await readFile(LOGO_PATH, "utf8");

  const logo = icon
    .replace('fill="#171717"', 'fill="#fafafa"')
    .replace('fill="#fff"', 'fill="#0d1117"');

  return `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;
}

export default async function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0d1117",
        color: "#fafafa",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {/* oxlint-disable-next-line next/no-img-element -- ImageResponse renders plain img elements, not next/image. */}
      <img alt="" src={await getLogoDataUrl()} style={{ height: 128, width: 128 }} />

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          fontSize: 72,
          letterSpacing: "-0.035em",
          lineHeight: 1.1,
          marginTop: 40,
        }}
      >
        {HEADLINE_LINES.map((line) => (
          <div key={line} style={{ display: "flex" }}>
            {line}
          </div>
        ))}
      </div>
    </div>,
    { ...size },
  );
}

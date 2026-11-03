import encodeQR from "qr";
import { FONT_WEIGHTS } from "./certificate-fonts";
import { CERTIFICATE_COLORS } from "./certificate-palette";
import { type ShapedText } from "./shaped-text";

const BRAND_NAME = "Zoonk";

/** The smallest quiet zone `qr` allows; the certificate's paper is the quiet zone, so it's left out. */
const QR_BORDER = 1;

/** A name or title drawn by Pango, placed on its first baseline as CSS would place the text. */
export function ShapedImage({ above, text }: { above: number; text: ShapedText }) {
  return (
    <div
      style={{
        display: "flex",
        height: text.blockHeight,
        marginTop: above,
        position: "relative",
        width: "100%",
      }}
    >
      {/* oxlint-disable-next-line next/no-img-element -- ImageResponse renders plain img elements, not next/image. */}
      <img
        alt=""
        height={text.height}
        src={text.src}
        style={{ left: 0, position: "absolute", top: text.top }}
        width={text.width}
      />
    </div>
  );
}

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

/*
 * Each picture inside Satori's drawing (an <img> or an inline <svg>) costs librsvg one compositing
 * pass over the whole canvas, about 0.1 s each on the print sheet, so marks are drawn with boxes.
 */

/** The check's legs, stroke and place as shares of its box, matched to the design's 16-unit glyph. */
const CHECK = { left: 0.36, long: 0.6, short: 0.3, stroke: 0.12, top: 0.12 };

export function CheckMark({ size }: { size: number }) {
  const stroke = `${size * CHECK.stroke}px solid ${CERTIFICATE_COLORS.success}`;

  return (
    <div
      style={{ display: "flex", flexShrink: 0, height: size, position: "relative", width: size }}
    >
      <div
        style={{
          borderBottom: stroke,
          borderRight: stroke,
          height: size * CHECK.long,
          left: size * CHECK.left,
          position: "absolute",
          top: size * CHECK.top,
          transform: "rotate(40deg)",
          width: size * CHECK.short,
        }}
      />
    </div>
  );
}

type QrRun = { length: number; start: number; y: number };

function addModule({ dark, runs, x, y }: { dark: boolean; runs: QrRun[]; x: number; y: number }) {
  const last = runs.at(-1);

  if (!dark) {
    return runs;
  }

  if (last && last.y === y && last.start + last.length === x) {
    return [...runs.slice(0, -1), { ...last, length: last.length + 1 }];
  }

  return [...runs, { length: 1, start: x, y }];
}

/** Each row's dark modules as runs, inside the quiet zone. */
function getQrRuns(matrix: boolean[][]): QrRun[] {
  return matrix
    .slice(QR_BORDER, -QR_BORDER)
    .flatMap((row, y) =>
      row
        .slice(QR_BORDER, -QR_BORDER)
        .reduce<QrRun[]>((runs, dark, x) => addModule({ dark, runs, x, y }), []),
    );
}

/** Module edges land on whole pixels, so no hairline seams show between rows. */
export function QrCode({ size, url }: { size: number; url: string }) {
  const matrix = encodeQR(url, "raw", { border: QR_BORDER, ecc: "medium" });
  const modules = matrix.length - QR_BORDER * 2;
  const edge = (index: number) => Math.round((index * size) / modules);

  return (
    <div
      style={{ display: "flex", flexShrink: 0, height: size, position: "relative", width: size }}
    >
      {getQrRuns(matrix).map((run) => (
        <div
          key={`${run.y}-${run.start}`}
          style={{
            background: CERTIFICATE_COLORS.ink,
            height: edge(run.y + 1) - edge(run.y),
            left: edge(run.start),
            position: "absolute",
            top: edge(run.y),
            width: edge(run.start + run.length) - edge(run.start),
          }}
        />
      ))}
    </div>
  );
}

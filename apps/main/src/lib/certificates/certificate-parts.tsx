import encodeQR from "qr";
import { CERTIFICATE_COLORS } from "./certificate-palette";
import { type CertificateGraph } from "./certificate-view";
import { type ShapedText } from "./shaped-text";

const CEFR_BANDS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const DENSE_ROUTE_CHAPTERS = 60;
const DENSE_STATION_SCALE = 0.6;

/** `qr` always adds a quiet zone; the certificate's white paper is the quiet zone, so the view crops it. */
const QR_BORDER = 1;

export function ShapedImage({ text }: { text: ShapedText }) {
  return (
    <div style={{ display: "flex", height: text.blockHeight, position: "relative", width: "100%" }}>
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
  fontSize,
  gap,
  logoSrc,
  logoSize,
}: {
  fontSize: number;
  gap: number;
  logoSrc: string;
  logoSize: number;
}) {
  return (
    <div style={{ alignItems: "center", display: "flex", gap }}>
      {/* oxlint-disable-next-line next/no-img-element -- ImageResponse renders plain img elements, not next/image. */}
      <img alt="" height={logoSize} src={logoSrc} width={logoSize} />
      <span style={{ fontSize, fontWeight: 640, letterSpacing: "-0.03em" }}>Zoonk</span>
    </div>
  );
}

export function QrCode({ size, url }: { size: number; url: string }) {
  const matrix = encodeQR(url, "raw", { border: QR_BORDER, ecc: "medium" });
  const modules = matrix.length - QR_BORDER * 2;

  const path = matrix
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : "")))
    .join("");

  return (
    <svg
      height={size}
      shapeRendering="crispEdges"
      viewBox={`${QR_BORDER} ${QR_BORDER} ${modules} ${modules}`}
      width={size}
    >
      <path d={path} fill={CERTIFICATE_COLORS.ink} />
    </svg>
  );
}

type RouteStyle = {
  height: number;
  labelGap: number;
  labelHeight: number;
  labelSize: number;
  ring: number;
  showLabels: boolean;
  square: number;
  squareRadius: number;
  station: number;
  stroke: number;
  tick: number;
  width: number;
};

type RouteZone = { chapters: number; label: string };

/** A course without levels draws its topics as stations, unlabelled; without either, the bare line. */
function getRouteZones({ topics, zones }: { topics: number; zones: RouteZone[] }): RouteZone[] {
  if (zones.some((zone) => zone.chapters > 0)) {
    return zones;
  }

  return topics > 0 ? [{ chapters: topics, label: "" }] : [];
}

function getZoneStarts(zones: RouteZone[]): number[] {
  return zones.map((_zone, index) =>
    zones.slice(0, index).reduce((sum, zone) => sum + zone.chapters, 0),
  );
}

export function CertificateRoute({
  style,
  topics,
  zones: givenZones,
}: {
  style: RouteStyle;
  topics: number;
  zones: RouteZone[];
}) {
  const zones = getRouteZones({ topics, zones: givenZones });
  const starts = getZoneStarts(zones);
  const total = zones.reduce((sum, zone) => sum + zone.chapters, 0);
  const pad = style.ring + style.stroke / 2;
  const step = (style.width - pad * 2) / (total + 1);
  const middle = style.height / 2;
  const end = style.width - pad;
  const station =
    total > DENSE_ROUTE_CHAPTERS ? style.station * DENSE_STATION_SCALE : style.station;
  const hasLabels = style.showLabels && zones.some((zone) => zone.label);

  const stations = Array.from({ length: total }, (_value, index) => pad + step * (index + 1));
  const ticks = starts.slice(1).map((start) => pad + step * (start + 0.5));

  return (
    <div style={{ display: "flex", flexDirection: "column", width: style.width }}>
      {hasLabels && (
        <div
          style={{
            display: "flex",
            height: style.labelHeight,
            marginBottom: style.labelGap,
            position: "relative",
          }}
        >
          {zones.map((zone, index) => (
            <span
              key={zone.label}
              style={{
                color: CERTIFICATE_COLORS.muted,
                fontFamily: "Geist Mono",
                fontSize: style.labelSize,
                left: index === 0 ? 0 : pad + step * ((starts[index] ?? 0) + 0.5),
                letterSpacing: 0,
                position: "absolute",
                top: 0,
                whiteSpace: "nowrap",
              }}
            >
              {zone.label}
            </span>
          ))}
        </div>
      )}

      <svg height={style.height} viewBox={`0 0 ${style.width} ${style.height}`} width={style.width}>
        <line
          stroke={CERTIFICATE_COLORS.success}
          strokeLinecap="round"
          strokeWidth={style.stroke}
          x1={pad}
          x2={end}
          y1={middle}
          y2={middle}
        />

        {stations.map((x) => (
          <circle cx={x} cy={middle} fill={CERTIFICATE_COLORS.success} key={x} r={station} />
        ))}

        {ticks.map((x) => (
          <line
            key={x}
            stroke={CERTIFICATE_COLORS.hairline}
            strokeWidth={style.tick}
            x1={x}
            x2={x}
            y1={middle - style.height * 0.38}
            y2={middle + style.height * 0.38}
          />
        ))}

        <circle
          cx={pad}
          cy={middle}
          fill={CERTIFICATE_COLORS.paper}
          r={style.ring}
          stroke={CERTIFICATE_COLORS.success}
          strokeWidth={style.stroke}
        />

        <rect
          fill={CERTIFICATE_COLORS.success}
          height={style.square * 2}
          rx={style.squareRadius}
          width={style.square * 2}
          x={end - style.square}
          y={middle - style.square}
        />
      </svg>
    </div>
  );
}

type LadderStyle = {
  bandGap: number;
  cellGap: number;
  cellHeight: number;
  labelGap: number;
  labelSize: number;
  radius: number;
};

function getBandCells(band: string): number {
  return band === "C2" ? 1 : 2;
}

export function CertificateLadder({
  graph,
  style,
}: {
  graph: Extract<CertificateGraph, { kind: "ladder" }>;
  style: LadderStyle;
}) {
  return (
    <div style={{ display: "flex", flexGrow: 1, gap: style.bandGap, minWidth: 0 }}>
      {CEFR_BANDS.map((band, bandIndex) => {
        const cells = getBandCells(band);
        const firstStep = bandIndex * 2;
        const reached = band === graph.reached;

        return (
          <div
            key={band}
            style={{
              display: "flex",
              flexBasis: 0,
              flexDirection: "column",
              flexGrow: cells,
              gap: style.labelGap,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", gap: style.cellGap }}>
              {Array.from({ length: cells }, (_value, cell) => (
                <div
                  key={cell}
                  style={{
                    background:
                      firstStep + cell < graph.filled
                        ? CERTIFICATE_COLORS.success
                        : CERTIFICATE_COLORS.track,
                    borderRadius: style.radius,
                    flexGrow: 1,
                    height: style.cellHeight,
                  }}
                />
              ))}
            </div>

            <span
              style={{
                color: reached ? CERTIFICATE_COLORS.ink : CERTIFICATE_COLORS.faint,
                fontFamily: "Geist Mono",
                fontSize: style.labelSize,
                fontWeight: reached ? 600 : 400,
                letterSpacing: 0,
              }}
            >
              {band}
            </span>
          </div>
        );
      })}
    </div>
  );
}

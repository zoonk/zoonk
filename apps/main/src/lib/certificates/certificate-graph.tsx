import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { type RouteLabel, fitRouteLabels } from "./certificate-layout";
import { CERTIFICATE_COLORS } from "./certificate-palette";
import { type CertificateView, type CertificateGraph as Graph } from "./certificate-view";

const ROUTE = {
  /** Past this many stations they shrink, so a long course's dots don't touch. */
  denseStationScale: 0.6,
  denseStations: 60,
  /** Ticks between levels reach this share of the line's height above and below it. */
  tickReach: 0.38,
};

const LADDER_WEIGHTS = { label: 400, reached: 600 };

type RouteSpec = {
  height: number;
  labelGap: number;
  labelHeight: number;
  labelSize: number;
  ring: number;
  square: number;
  squareRadius: number;
  station: number;
  stroke: number;
  tick: number;
  width: number;
};

type LadderSpec = {
  bandGap: number;
  cellGap: number;
  cellHeight: number;
  labelGap: number;
  labelSize: number;
  radius: number;
};

type RouteZone = { chapters: number; label: string };

type RouteGraph = Extract<Graph, { kind: "route" }>;

/** A course without levels draws its topics as stations, unlabelled; without either, the bare line. */
function getRouteZones({ topics, zones }: RouteGraph): RouteZone[] {
  if (zones.some((zone) => zone.chapters > 0)) {
    return zones;
  }

  return topics > 0 ? [{ chapters: topics, label: "" }] : [];
}

/** Stations sit a step apart between the start ring and the end square; a level starts half a step before its first. */
function getRouteGeometry({ spec, zones }: { spec: RouteSpec; zones: RouteZone[] }) {
  const total = zones.reduce((sum, zone) => sum + zone.chapters, 0);
  const pad = spec.ring + spec.stroke / 2;
  const step = (spec.width - pad * 2) / (total + 1);

  const zoneStarts = zones.map(
    (_zone, index) =>
      pad +
      step * (zones.slice(0, index).reduce((sum, zone) => sum + zone.chapters, 0) + 1) -
      step / 2,
  );

  return {
    end: spec.width - pad,
    middle: spec.height / 2,
    pad,
    station: total > ROUTE.denseStations ? spec.station * ROUTE.denseStationScale : spec.station,
    stations: Array.from({ length: total }, (_value, index) => pad + step * (index + 1)),
    zoneStarts,
  };
}

function scaleRoute(spec: RouteSpec, scale: number): RouteSpec {
  return {
    height: spec.height * scale,
    labelGap: spec.labelGap * scale,
    labelHeight: spec.labelHeight * scale,
    labelSize: spec.labelSize * scale,
    ring: spec.ring * scale,
    square: spec.square * scale,
    squareRadius: spec.squareRadius * scale,
    station: spec.station * scale,
    stroke: spec.stroke * scale,
    tick: spec.tick * scale,
    width: spec.width * scale,
  };
}

function RouteLabels({ labels, spec }: { labels: RouteLabel[]; spec: RouteSpec }) {
  return (
    <div
      style={{
        display: "flex",
        height: spec.labelHeight,
        marginBottom: spec.labelGap,
        position: "relative",
      }}
    >
      {labels.map(({ label, left }) => (
        <span
          key={label}
          style={{
            color: CERTIFICATE_COLORS.muted,
            fontFamily: "Geist Mono",
            fontSize: spec.labelSize,
            left,
            letterSpacing: 0,
            position: "absolute",
            top: 0,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/** The course's chapters in order as stations through its levels; on a certificate all of it is done. */
function CertificateRoute({
  graph,
  showLabels,
  spec,
}: {
  graph: RouteGraph;
  showLabels: boolean;
  spec: RouteSpec;
}) {
  const zones = getRouteZones(graph);
  const { end, middle, pad, station, stations, zoneStarts } = getRouteGeometry({ spec, zones });
  const tickReach = spec.height * ROUTE.tickReach;

  const labels = fitRouteLabels({
    fontSize: spec.labelSize,
    labels: zones.map(({ label }, index) => ({
      label,
      left: index === 0 ? 0 : (zoneStarts[index] ?? 0),
    })),
    width: spec.width,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", width: spec.width }}>
      {showLabels && zones.some((zone) => zone.label) && (
        <RouteLabels labels={labels} spec={spec} />
      )}

      <div
        style={{ display: "flex", height: spec.height, position: "relative", width: spec.width }}
      >
        <Dot
          color={CERTIFICATE_COLORS.success}
          height={spec.stroke}
          left={pad - spec.stroke / 2}
          radius={spec.stroke / 2}
          top={middle - spec.stroke / 2}
          width={end - pad + spec.stroke}
        />

        {stations.map((x) => (
          <Dot
            color={CERTIFICATE_COLORS.success}
            height={station * 2}
            key={x}
            left={x - station}
            radius={station}
            top={middle - station}
            width={station * 2}
          />
        ))}

        {zoneStarts.slice(1).map((x) => (
          <Dot
            color={CERTIFICATE_COLORS.hairline}
            height={tickReach * 2}
            key={x}
            left={x - spec.tick / 2}
            radius={0}
            top={middle - tickReach}
            width={spec.tick}
          />
        ))}

        <div
          style={{
            background: CERTIFICATE_COLORS.paper,
            border: `${spec.stroke}px solid ${CERTIFICATE_COLORS.success}`,
            borderRadius: spec.ring + spec.stroke,
            height: (spec.ring + spec.stroke / 2) * 2,
            left: pad - spec.ring - spec.stroke / 2,
            position: "absolute",
            top: middle - spec.ring - spec.stroke / 2,
            width: (spec.ring + spec.stroke / 2) * 2,
          }}
        />

        <Dot
          color={CERTIFICATE_COLORS.success}
          height={spec.square * 2}
          left={end - spec.square}
          radius={spec.squareRadius}
          top={middle - spec.square}
          width={spec.square * 2}
        />
      </div>
    </div>
  );
}

/** One of the route's marks: a box, the line or a station, placed on the route. */
function Dot({
  color,
  height,
  left,
  radius,
  top,
  width,
}: {
  color: string;
  height: number;
  left: number;
  radius: number;
  top: number;
  width: number;
}) {
  return (
    <div
      style={{
        background: color,
        borderRadius: radius,
        height,
        left,
        position: "absolute",
        top,
        width,
      }}
    />
  );
}

/** C2 has no "+" step. */
function getBandCells(band: string): number {
  return band === "C2" ? 1 : 2;
}

/** A1 to C2 in half steps, filled to the certified level. */
function CertificateLadder({
  graph,
  scale,
  spec,
}: {
  graph: Extract<Graph, { kind: "ladder" }>;
  scale: number;
  spec: LadderSpec;
}) {
  return (
    <div style={{ display: "flex", flexGrow: 1, gap: spec.bandGap * scale, minWidth: 0 }}>
      {CEFR_LEVELS.map((band, bandIndex) => {
        const cells = getBandCells(band);
        const reached = band === graph.reached;

        return (
          <div
            key={band}
            style={{
              display: "flex",
              flexBasis: 0,
              flexDirection: "column",
              flexGrow: cells,
              gap: spec.labelGap * scale,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", gap: spec.cellGap * scale }}>
              {Array.from({ length: cells }, (_value, cell) => (
                <div
                  key={cell}
                  style={{
                    background:
                      bandIndex * 2 + cell < graph.filled
                        ? CERTIFICATE_COLORS.success
                        : CERTIFICATE_COLORS.track,
                    borderRadius: spec.radius * scale,
                    flexGrow: 1,
                    height: spec.cellHeight * scale,
                  }}
                />
              ))}
            </div>

            <span
              style={{
                color: reached ? CERTIFICATE_COLORS.ink : CERTIFICATE_COLORS.faint,
                fontFamily: "Geist Mono",
                fontSize: spec.labelSize * scale,
                fontWeight: reached ? LADDER_WEIGHTS.reached : LADDER_WEIGHTS.label,
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

/** A course's route through its levels, or a language's CEFR ladder. */
export function CertificateGraph({
  ladder,
  route,
  scale,
  showLabels,
  view,
}: {
  ladder: LadderSpec;
  route: RouteSpec;
  scale: number;
  showLabels: boolean;
  view: CertificateView;
}) {
  if (view.graph.kind === "ladder") {
    return <CertificateLadder graph={view.graph} scale={scale} spec={ladder} />;
  }

  return (
    <CertificateRoute graph={view.graph} showLabels={showLabels} spec={scaleRoute(route, scale)} />
  );
}

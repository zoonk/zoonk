import { CERTIFICATE_COLORS } from "./certificate-palette";
import { type CertificateView } from "./certificate-view";

const ROUTE = {
  /** Past this many stations they shrink, so a long course's dots don't touch. */
  denseStationScale: 0.6,
  denseStations: 60,
};

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
  width: number;
};

/** Stations sit a step apart between the start ring and the end square. */
function getRouteGeometry({ spec, stations }: { spec: RouteSpec; stations: number }) {
  const pad = spec.ring + spec.stroke / 2;
  const step = (spec.width - pad * 2) / (stations + 1);

  return {
    end: spec.width - pad,
    middle: spec.height / 2,
    pad,
    station: stations > ROUTE.denseStations ? spec.station * ROUTE.denseStationScale : spec.station,
    stations: Array.from({ length: stations }, (_value, index) => pad + step * (index + 1)),
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
    width: spec.width * scale,
  };
}

function RouteLabel({ label, spec }: { label: string; spec: RouteSpec }) {
  return (
    <span
      style={{
        color: CERTIFICATE_COLORS.muted,
        fontFamily: "Geist Mono",
        fontSize: spec.labelSize,
        height: spec.labelHeight,
        letterSpacing: 0,
        marginBottom: spec.labelGap,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/** The topics in order as stations along the route; on a certificate all of it is done. */
export function CertificateGraph({
  route,
  scale,
  showLabels,
  view,
}: {
  route: RouteSpec;
  scale: number;
  showLabels: boolean;
  view: CertificateView;
}) {
  const { graph } = view;
  const spec = scaleRoute(route, scale);

  const { end, middle, pad, station, stations } = getRouteGeometry({
    spec,
    stations: graph.stations,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", width: spec.width }}>
      {showLabels && graph.label && <RouteLabel label={graph.label} spec={spec} />}

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

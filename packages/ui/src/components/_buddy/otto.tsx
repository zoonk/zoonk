import {
  BELT_FILL,
  type BuddyBodyProps,
  BuddyHalo,
  BuddyHaloGradient,
  buddyDefId,
  buddyDefUrl,
} from "./buddy-parts";

const SPOTS = [
  { cx: 62, cy: 25, halo: 9, radius: 3.6 },
  { cx: 81, cy: 31, halo: 7.5, radius: 3 },
  { cx: 90, cy: 45, halo: 6, radius: 2.4 },
] as const;

/** Otto, a know-it-all octopus whose spots glow with Energy and dim while it naps. */
export function OttoBody({ glow, isGlowing, isNapping, uid }: BuddyBodyProps) {
  return (
    <>
      <defs>
        <radialGradient cx="35%" cy="26%" id={buddyDefId(uid, "otto-skin")} r="82%">
          <stop offset="0" stopColor="#f1e9ff" />
          <stop offset=".5" stopColor="#c6adff" />
          <stop offset="1" stopColor="#8c69f0" />
        </radialGradient>
        <BuddyHaloGradient uid={uid} />
      </defs>

      <ellipse cx="60" cy="116" fill="#000" opacity=".12" rx="30" ry="3.4" />
      <g fill="none" stroke="#a88af7" strokeLinecap="round" strokeWidth="9">
        <path d="M36 84 C 28 95, 18 99, 16 107 C 15 113, 23 114, 25 109" />
        <path d="M84 84 C 92 95, 102 99, 104 107 C 105 113, 97 114, 95 109" />
        <path d="M48 88 C 44 99, 39 105, 42 112" />
        <path d="M72 88 C 76 99, 81 105, 78 112" />
        <path d="M60 90 C 60 100, 57 106, 61 112" />
      </g>
      <g fill="#efe6ff" opacity=".9">
        <circle cx="19" cy="104" r="1.8" />
        <circle cx="101" cy="104" r="1.8" />
        <circle cx="43.5" cy="106" r="1.6" />
        <circle cx="76.5" cy="106" r="1.6" />
        <circle cx="59" cy="104" r="1.6" />
      </g>
      <path
        d="M60 16 C 86 16, 102 35, 102 58 C 102 79, 88 92, 60 92 C 32 92, 18 79, 18 58 C 18 35, 34 16, 60 16 Z"
        fill={buddyDefUrl(uid, "otto-skin")}
      />
      <rect
        height="7"
        rx="3.5"
        stroke="#000"
        strokeOpacity=".16"
        strokeWidth="1.2"
        style={BELT_FILL}
        width="66"
        x="27"
        y="87"
      />
      <path
        d="M82.5 91 l-3 9 l3.6 .8 l2.4 -8 z"
        stroke="#000"
        strokeOpacity=".16"
        strokeWidth="1"
        style={BELT_FILL}
      />
      <path
        d="M85.5 91 l5 8 l-3.4 1.4 l-3.6 -7.6 z"
        stroke="#000"
        strokeOpacity=".16"
        strokeWidth="1"
        style={BELT_FILL}
      />
      <rect
        height="10"
        rx="3"
        stroke="#000"
        strokeOpacity=".2"
        strokeWidth="1"
        style={BELT_FILL}
        width="10"
        x="79"
        y="85.5"
      />
      <ellipse
        cx="44"
        cy="30"
        fill="#fff"
        opacity=".42"
        rx="13"
        ry="6"
        transform="rotate(-14 44 30)"
      />
      <ellipse cx="28" cy="74" fill="#ff7ab6" opacity=".5" rx="5.5" ry="3.2" />
      <ellipse cx="92" cy="74" fill="#ff7ab6" opacity=".5" rx="5.5" ry="3.2" />

      {SPOTS.map((spot) => (
        <g key={`${spot.cx}-${spot.cy}`}>
          {!isNapping && (
            <BuddyHalo
              cx={spot.cx}
              cy={spot.cy}
              glow={glow}
              isGlowing={isGlowing}
              radius={spot.halo}
              uid={uid}
            />
          )}
          <circle
            cx={spot.cx}
            cy={spot.cy}
            fill={isNapping ? "#b69cf2" : "#ff8a3d"}
            r={spot.radius}
          />
        </g>
      ))}
    </>
  );
}

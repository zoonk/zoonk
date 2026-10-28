import { Part } from "../_character/part";
import { BELT_FILL, type BuddyBodyProps, buddyDefId, buddyDefUrl } from "./buddy-parts";

const SPOTS = [
  { cx: 62, cy: 25, radius: 3.6 },
  { cx: 81, cy: 31, radius: 3 },
  { cx: 90, cy: 45, radius: 2.4 },
] as const;

const SPOT_FILL = "#b69cf2";

const TENTACLE = {
  fill: "none",
  stroke: "#a88af7",
  strokeLinecap: "round",
  strokeWidth: 9,
} as const;

const TENTACLE_TIP = { fill: "#efe6ff", opacity: 0.9 } as const;

export function OttoBody({ face, uid }: BuddyBodyProps) {
  return (
    <>
      <defs>
        <radialGradient cx="35%" cy="26%" id={buddyDefId(uid, "otto-skin")} r="82%">
          <stop offset="0" stopColor="#f1e9ff" />
          <stop offset=".5" stopColor="#c6adff" />
          <stop offset="1" stopColor="#8c69f0" />
        </radialGradient>
      </defs>

      <Part name="shadow" pivot={[60, 116]}>
        <ellipse cx="60" cy="116" fill="#000" opacity=".12" rx="30" ry="3.4" />
      </Part>
      <Part name="body" pivot={[60, 112]}>
        <Part name="arm-left" pivot={[36, 84]}>
          <path {...TENTACLE} d="M36 84 C 28 95, 18 99, 16 107 C 15 113, 23 114, 25 109" />
          <circle {...TENTACLE_TIP} cx="19" cy="104" r="1.8" />
        </Part>
        <Part name="arm-right" pivot={[84, 84]}>
          <path {...TENTACLE} d="M84 84 C 92 95, 102 99, 104 107 C 105 113, 97 114, 95 109" />
          <circle {...TENTACLE_TIP} cx="101" cy="104" r="1.8" />
        </Part>
        <Part name="feet" pivot={[60, 112]}>
          <path {...TENTACLE} d="M48 88 C 44 99, 39 105, 42 112" />
          <path {...TENTACLE} d="M72 88 C 76 99, 81 105, 78 112" />
          <path {...TENTACLE} d="M60 90 C 60 100, 57 106, 61 112" />
          <circle {...TENTACLE_TIP} cx="43.5" cy="106" r="1.6" />
          <circle {...TENTACLE_TIP} cx="76.5" cy="106" r="1.6" />
          <circle {...TENTACLE_TIP} cx="59" cy="104" r="1.6" />
        </Part>
        <Part name="head" pivot={[60, 90]}>
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

          {SPOTS.map((spot) => (
            <circle
              cx={spot.cx}
              cy={spot.cy}
              fill={SPOT_FILL}
              key={`${spot.cx}-${spot.cy}`}
              r={spot.radius}
            />
          ))}
          {face}
        </Part>
      </Part>
    </>
  );
}

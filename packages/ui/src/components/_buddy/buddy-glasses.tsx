import { type BuddyGlasses } from "@zoonk/utils/buddy";
import { Spark, buddyDefId, buddyDefUrl } from "./buddy-parts";

/** Mirrors a left lens onto the right eye around the face's vertical axis. */
const MIRROR = "matrix(-1 0 0 1 120 0)";

const HIGHLIGHT = { fill: "none", stroke: "#fff", strokeLinecap: "round" } as const;

function GoldGradient({ uid }: { uid: string }) {
  return (
    <linearGradient id={buddyDefId(uid, "glasses-gold")} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stopColor="#ffe7a3" />
      <stop offset=".5" stopColor="#f2b53c" />
      <stop offset="1" stopColor="#b87412" />
    </linearGradient>
  );
}

function RoundGlasses() {
  return (
    <g>
      <g stroke="#221b52" strokeLinecap="round" strokeWidth="3.4">
        <path d="M31 55 L19 51" />
        <path d="M89 55 L101 51" />
      </g>
      <g fill="#fff" fillOpacity=".14" stroke="#221b52" strokeWidth="3.8">
        <circle cx="44" cy="58" r="14" />
        <circle cx="76" cy="58" r="14" />
      </g>
      <path
        d="M58 56.5 Q60 53 62 56.5"
        fill="none"
        stroke="#221b52"
        strokeLinecap="round"
        strokeWidth="3.4"
      />
      <g {...HIGHLIGHT} opacity=".75" strokeWidth="2.2">
        <path d="M35 51 Q38 47 43 46" />
        <path d="M67 51 Q70 47 75 46" />
      </g>
    </g>
  );
}

const STAR_LEFT =
  "M41.01 39.60 L48.50 48.97 L60.36 50.77 L53.76 60.79 L55.71 72.62 L44.15 69.44 L33.50 74.95 L32.95 62.97 L24.42 54.55 L35.64 50.33 Z";

const STAR_RIGHT =
  "M78.99 39.60 L84.36 50.33 L95.58 54.55 L87.05 62.97 L86.50 74.95 L75.85 69.44 L64.29 72.62 L66.24 60.79 L59.64 50.77 L71.50 48.97 Z";

function StarGlasses() {
  return (
    <g>
      <g stroke="#b86b00" strokeLinecap="round" strokeWidth="3.4">
        <path d="M24.4 54.5 L18 51.5" />
        <path d="M95.6 54.5 L102 51.5" />
      </g>
      <g fill="#ffd36e" fillOpacity=".16" stroke="#b86b00" strokeLinejoin="round" strokeWidth="5.4">
        <path d={STAR_LEFT} />
        <path d={STAR_RIGHT} />
      </g>
      <g fill="none" stroke="#ffcf4a" strokeLinejoin="round" strokeWidth="3">
        <path d={STAR_LEFT} />
        <path d={STAR_RIGHT} />
      </g>
      <g stroke="#fff6d6" strokeLinecap="round" strokeWidth="1.6">
        <path d="M36 50.5 L40.6 43.5" />
        <path d="M72 50.5 L76.6 43.5" />
      </g>
      <Spark fill="#fff" size={8} x={92} y={36} />
    </g>
  );
}

const AVIATOR_LENS =
  "M29 50 C29 47.5, 31 46.5, 34 46.5 L55 46.5 C58.5 46.5, 59.5 49.5, 58.5 53 C56.5 62, 52 71, 42 71.5 C33 72, 28.5 64, 29 50 Z";

function AviatorGlasses({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <GoldGradient uid={uid} />
        <linearGradient id={buddyDefId(uid, "glasses-mirror")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1b1f5e" stopOpacity=".82" />
          <stop offset=".55" stopColor="#3a5bb8" stopOpacity=".55" />
          <stop offset="1" stopColor="#7cf5ff" stopOpacity=".4" />
        </linearGradient>
      </defs>
      <g stroke="#c98b1c" strokeLinecap="round" strokeWidth="2.4">
        <path d="M29.5 49.5 L19 48.5" />
        <path d="M90.5 49.5 L101 48.5" />
      </g>
      <g
        fill={buddyDefUrl(uid, "glasses-mirror")}
        stroke={buddyDefUrl(uid, "glasses-gold")}
        strokeLinejoin="round"
        strokeWidth="2.6"
      >
        <path d={AVIATOR_LENS} />
        <path d={AVIATOR_LENS} transform={MIRROR} />
      </g>
      <path d="M55 46.5 L65 46.5" stroke="#e0a534" strokeWidth="2.6" />
      <path
        d="M57.5 52.5 Q60 50.3 62.5 52.5"
        fill="none"
        stroke="#e0a534"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <g {...HIGHLIGHT} opacity=".55" strokeWidth="2.6">
        <path d="M33 60 L45 49" />
        <path d="M65 60 L77 49" />
      </g>
      <g {...HIGHLIGHT} opacity=".4" strokeWidth="1.8">
        <path d="M36 65 L41 60.5" />
        <path d="M68 65 L73 60.5" />
      </g>
    </g>
  );
}

const CAT_EYE_LENS =
  "M57 52 C50 46, 38 45, 26.5 43.5 C28 50, 29 56, 31.5 62 C34.5 70, 46 73, 53.5 68.5 C58.5 65, 59.5 57, 57 52 Z";

function CatEyeGlasses() {
  return (
    <g>
      <g stroke="#c42a6e" strokeLinecap="round" strokeWidth="3.2">
        <path d="M29.5 50 L19 49" />
        <path d="M90.5 50 L101 49" />
      </g>
      <g fill="#fff" fillOpacity=".14" stroke="#ff4f9a" strokeLinejoin="round" strokeWidth="3.8">
        <path d={CAT_EYE_LENS} />
        <path d={CAT_EYE_LENS} transform={MIRROR} />
      </g>
      <path
        d="M56.5 53.5 Q60 50 63.5 53.5"
        fill="none"
        stroke="#ff4f9a"
        strokeLinecap="round"
        strokeWidth="3.4"
      />
      <g {...HIGHLIGHT} opacity=".7" strokeWidth="2">
        <path d="M33 50 Q37 47.5 42 47.5" />
        <path d="M78 47.5 Q83 47.5 87 50" />
      </g>
      <circle cx="28.5" cy="45.5" fill="#fff" r="1.9" />
      <circle cx="91.5" cy="45.5" fill="#fff" r="1.9" />
      <circle cx="32.8" cy="46.6" fill="#ffe0f0" r="1.1" />
      <circle cx="87.2" cy="46.6" fill="#ffe0f0" r="1.1" />
    </g>
  );
}

function RetroGlasses({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={buddyDefId(uid, "glasses-tortoise")} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#6b3514" />
          <stop offset=".3" stopColor="#b8692c" />
          <stop offset=".55" stopColor="#4a220c" />
          <stop offset=".8" stopColor="#a45a22" />
          <stop offset="1" stopColor="#3d1b08" />
        </linearGradient>
      </defs>
      <g stroke="#5a2a10" strokeLinecap="round" strokeWidth="4">
        <path d="M29.5 50 L18.5 48.5" />
        <path d="M90.5 50 L101.5 48.5" />
      </g>
      <g
        fill="#fff"
        fillOpacity=".12"
        stroke={buddyDefUrl(uid, "glasses-tortoise")}
        strokeWidth="5"
      >
        <rect height="25" rx="7" width="29" x="29.5" y="45.5" />
        <rect height="25" rx="7" width="29" x="61.5" y="45.5" />
      </g>
      <path
        d="M57.5 53 Q60 49.5 62.5 53"
        fill="none"
        stroke="#6b3514"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <g {...HIGHLIGHT} opacity=".7" strokeWidth="1.8">
        <path d="M34 50.5 L41 50.5" />
        <path d="M66 50.5 L73 50.5" />
      </g>
      <circle cx="31" cy="47.5" fill="#f3d9a4" r="1.2" />
      <circle cx="89" cy="47.5" fill="#f3d9a4" r="1.2" />
    </g>
  );
}

function MonocleGlasses({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <GoldGradient uid={uid} />
      </defs>
      <path
        d="M86.5 69 C 94 80, 88 92, 74 97.5"
        fill="none"
        stroke="#e0a534"
        strokeDasharray="2.6 1.8"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle
        cx="76"
        cy="58"
        fill="#fff"
        fillOpacity=".16"
        r="14.5"
        stroke={buddyDefUrl(uid, "glasses-gold")}
        strokeWidth="3.6"
      />
      <circle cx="76" cy="58" fill="none" opacity=".7" r="12" stroke="#9c6b12" strokeWidth=".9" />
      <path d="M67 51 Q70 46.5 75 45.5" {...HIGHLIGHT} opacity=".75" strokeWidth="2.2" />
      <circle cx="87" cy="68" fill="#f2b53c" r="1.8" />
    </g>
  );
}

export function BuddyGlassesFrame({ glasses, uid }: { glasses: BuddyGlasses; uid: string }) {
  switch (glasses) {
    case "aviator":
      return <AviatorGlasses uid={uid} />;
    case "catEye":
      return <CatEyeGlasses />;
    case "monocle":
      return <MonocleGlasses uid={uid} />;
    case "retro":
      return <RetroGlasses uid={uid} />;
    case "round":
      return <RoundGlasses />;
    case "star":
      return <StarGlasses />;
    default:
      return null;
  }
}

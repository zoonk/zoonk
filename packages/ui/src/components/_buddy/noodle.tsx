import {
  BELT_FILL,
  type BuddyBodyProps,
  BuddyHalo,
  BuddyHaloGradient,
  Spark,
  buddyDefId,
  buddyDefUrl,
} from "./buddy-parts";

/** The faint third spark never fully disappears while Noodle is awake. */
const FAINT_SPARK_MIN_OPACITY = 0.25;

function NoodleSparks({ glow, isGlowing, uid }: Omit<BuddyBodyProps, "isNapping">) {
  return (
    <g>
      <BuddyHalo cx={15} cy={21} glow={glow} isGlowing={isGlowing} radius={10} uid={uid} />
      <BuddyHalo cx={104} cy={19} glow={glow} isGlowing={isGlowing} radius={11} uid={uid} />
      <Spark fill="#ff8a3d" size={12} x={9} y={15} />
      <Spark fill="#ff8a3d" size={14} x={97} y={12} />
      <Spark
        fill="#ffb35c"
        opacity={FAINT_SPARK_MIN_OPACITY + glow * (1 - FAINT_SPARK_MIN_OPACITY)}
        size={8}
        x={88}
        y={1}
      />
    </g>
  );
}

/** Noodle, a brain with legs whose sparks glow with Energy. Sparks rest while it naps. */
export function NoodleBody({ glow, isGlowing, isNapping, uid }: BuddyBodyProps) {
  return (
    <>
      <defs>
        <radialGradient cx="40%" cy="30%" id={buddyDefId(uid, "noodle-shade")} r="75%">
          <stop offset="0" stopColor="#ffb3cb" />
          <stop offset="1" stopColor="#ff7aa6" />
        </radialGradient>
        <BuddyHaloGradient uid={uid} />
        <clipPath id={buddyDefId(uid, "noodle-clip")}>
          <circle cx="40" cy="46" r="22" />
          <circle cx="60" cy="37" r="25" />
          <circle cx="80" cy="46" r="22" />
          <ellipse cx="60" cy="70" rx="44" ry="37" />
        </clipPath>
      </defs>

      <ellipse cx="60" cy="113" fill="#000" opacity=".08" rx="30" ry="4.5" />
      <ellipse cx="47" cy="106" fill="#e8628f" rx="9" ry="6" />
      <ellipse cx="73" cy="106" fill="#e8628f" rx="9" ry="6" />
      <ellipse cx="17" cy="74" fill="#ff8fb3" rx="7" ry="9" transform="rotate(25 17 74)" />
      <ellipse cx="103" cy="74" fill="#ff8fb3" rx="7" ry="9" transform="rotate(-25 103 74)" />
      <g clipPath={buddyDefUrl(uid, "noodle-clip")}>
        <rect fill={buddyDefUrl(uid, "noodle-shade")} height="120" width="120" x="0" y="0" />
        <rect height="11" style={BELT_FILL} width="120" x="0" y="86" />
        <rect
          fill="none"
          height="11"
          stroke="#000"
          strokeOpacity=".12"
          strokeWidth="1.5"
          width="120"
          x="0"
          y="86"
        />
      </g>
      <g fill="none" opacity=".8" stroke="#e0598a" strokeLinecap="round" strokeWidth="3">
        <path d="M47 27 q6 -7 13 -1" />
        <path d="M65 22 q7 -5 13 2" />
        <path d="M28 46 q5 -6 11 -2" />
        <path d="M82 44 q6 -4 11 2" />
        <path d="M58 40 q3 -4 7 -2" />
      </g>
      <ellipse
        cx="44"
        cy="30"
        fill="#fff"
        opacity=".35"
        rx="9"
        ry="5"
        transform="rotate(-20 44 30)"
      />
      <path
        d="M58 91 l-9 14 l5 2 l8 -12 z"
        stroke="#000"
        strokeOpacity=".15"
        strokeWidth="1.2"
        style={BELT_FILL}
      />
      <path
        d="M62 91 l9 14 l-5 2 l-8 -12 z"
        stroke="#000"
        strokeOpacity=".15"
        strokeWidth="1.2"
        style={BELT_FILL}
      />
      <rect
        height="14"
        rx="4"
        stroke="#000"
        strokeOpacity=".18"
        strokeWidth="1.2"
        style={BELT_FILL}
        width="14"
        x="53"
        y="84"
      />
      <ellipse cx="29" cy="76" fill="#ff4f86" opacity=".38" rx="6" ry="3.5" />
      <ellipse cx="91" cy="76" fill="#ff4f86" opacity=".38" rx="6" ry="3.5" />

      {!isNapping && <NoodleSparks glow={glow} isGlowing={isGlowing} uid={uid} />}
    </>
  );
}

import {
  BELT_FILL,
  type BuddyBodyProps,
  BuddyHalo,
  BuddyHaloGradient,
  buddyDefId,
  buddyDefUrl,
} from "./buddy-parts";

/** Zu, a curious alien whose antenna tips glow with Energy. */
export function ZuBody({ glow, isGlowing, isNapping, uid }: BuddyBodyProps) {
  return (
    <>
      <defs>
        <radialGradient cx="35%" cy="28%" id={buddyDefId(uid, "zu-skin")} r="80%">
          <stop offset="0" stopColor="#c9fff0" />
          <stop offset=".55" stopColor="#86ecd0" />
          <stop offset="1" stopColor="#4fcdac" />
        </radialGradient>
        <BuddyHaloGradient uid={uid} />
        <clipPath id={buddyDefId(uid, "zu-belt")}>
          <ellipse cx="60" cy="97" rx="21" ry="15.5" />
        </clipPath>
      </defs>

      {isNapping ? (
        <g>
          <path
            d="M48 31 Q40 25 31 27"
            fill="none"
            stroke="#3fb897"
            strokeLinecap="round"
            strokeWidth="3.6"
          />
          <path
            d="M72 31 Q80 25 89 27"
            fill="none"
            stroke="#3fb897"
            strokeLinecap="round"
            strokeWidth="3.6"
          />
          <circle cx="30" cy="27.5" fill="#c9a37e" r="4.6" />
          <circle cx="90" cy="27.5" fill="#c9a37e" r="4.6" />
        </g>
      ) : (
        <g>
          <path
            d="M48 31 Q45 19 37 12"
            fill="none"
            stroke="#3fb897"
            strokeLinecap="round"
            strokeWidth="3.6"
          />
          <path
            d="M72 31 Q75 19 83 12"
            fill="none"
            stroke="#3fb897"
            strokeLinecap="round"
            strokeWidth="3.6"
          />
          <BuddyHalo cx={36} cy={11} glow={glow} isGlowing={isGlowing} radius={11} uid={uid} />
          <BuddyHalo cx={84} cy={11} glow={glow} isGlowing={isGlowing} radius={11} uid={uid} />
          <circle cx="36" cy="11" fill="#ff8a3d" r="5.2" />
          <circle cx="84" cy="11" fill="#ff8a3d" r="5.2" />
          <circle cx="34.4" cy="9.4" fill="#fff" opacity=".85" r="1.7" />
          <circle cx="82.4" cy="9.4" fill="#fff" opacity=".85" r="1.7" />
        </g>
      )}

      <ellipse cx="60" cy="115" fill="#000" opacity=".12" rx="24" ry="3.8" />
      <ellipse cx="51" cy="111" fill="#3fb897" rx="7.5" ry="4.6" />
      <ellipse cx="69" cy="111" fill="#3fb897" rx="7.5" ry="4.6" />
      <ellipse cx="39" cy="96" fill="#6fdfbf" rx="5.5" ry="8" transform="rotate(28 39 96)" />
      <ellipse cx="81" cy="96" fill="#6fdfbf" rx="5.5" ry="8" transform="rotate(-28 81 96)" />
      <ellipse cx="60" cy="97" fill={buddyDefUrl(uid, "zu-skin")} rx="21" ry="15.5" />
      <g clipPath={buddyDefUrl(uid, "zu-belt")}>
        <rect height="7.5" style={BELT_FILL} width="60" x="30" y="96" />
        <rect
          fill="none"
          height="7.5"
          stroke="#000"
          strokeOpacity=".14"
          strokeWidth="1.2"
          width="60"
          x="30"
          y="96"
        />
      </g>
      <path
        d="M58.5 101 l-6 9 l3.6 1.2 l5 -8 z"
        stroke="#000"
        strokeOpacity=".16"
        strokeWidth="1"
        style={BELT_FILL}
      />
      <path
        d="M61.5 101 l6 9 l-3.6 1.2 l-5 -8 z"
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
        x="55"
        y="94.5"
      />
      <ellipse cx="60" cy="56" fill={buddyDefUrl(uid, "zu-skin")} rx="42" ry="33" />
      <ellipse
        cx="44"
        cy="33"
        fill="#fff"
        opacity=".4"
        rx="13"
        ry="6"
        transform="rotate(-14 44 33)"
      />
      <circle cx="84" cy="38" fill="#fff" opacity=".28" r="3.2" />
      <circle cx="91" cy="46" fill="#fff" opacity=".28" r="2" />
      <circle cx="30" cy="42" fill="#fff" opacity=".22" r="2.4" />
      <ellipse cx="28" cy="75" fill="#ff7ab6" opacity=".45" rx="5.5" ry="3.2" />
      <ellipse cx="92" cy="75" fill="#ff7ab6" opacity=".45" rx="5.5" ry="3.2" />
    </>
  );
}

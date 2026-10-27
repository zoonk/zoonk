import { Part } from "../_character/part";
import {
  BELT_FILL,
  type BuddyBodyProps,
  BuddyHalo,
  BuddyHaloGradient,
  buddyDefId,
  buddyDefUrl,
} from "./buddy-parts";

function Antenna({ glow, isNapping, uid }: Omit<BuddyBodyProps, "face">) {
  return (
    <Part name="antenna" pivot={[60, 26]}>
      {isNapping ? (
        <>
          <path
            d="M60 26 Q60 18 68 17"
            fill="none"
            stroke="#7c86c4"
            strokeLinecap="round"
            strokeWidth="3.6"
          />
          <circle cx="71.5" cy="17" fill="#c9a37e" r="4.6" />
        </>
      ) : (
        <>
          <path d="M60 26 V15" stroke="#7c86c4" strokeLinecap="round" strokeWidth="3.6" />
          <BuddyHalo cx={60} cy={10} glow={glow} radius={10} uid={uid} />
          <circle cx="60" cy="10" fill="#ff8a3d" r="5.2" />
          <circle cx="58.4" cy="8.4" fill="#fff" opacity=".85" r="1.7" />
        </>
      )}
    </Part>
  );
}

/** Beep, a tidy robot whose antenna bulb glows with Energy. */
export function BeepBody({ face, glow, isNapping, uid }: BuddyBodyProps) {
  const metal = buddyDefUrl(uid, "beep-metal");

  return (
    <>
      <defs>
        <linearGradient id={buddyDefId(uid, "beep-metal")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f4f5ff" />
          <stop offset=".6" stopColor="#cdd2f2" />
          <stop offset="1" stopColor="#a1aadb" />
        </linearGradient>
        <BuddyHaloGradient uid={uid} />
        <clipPath id={buddyDefId(uid, "beep-belt")}>
          <rect height="22" rx="10" width="44" x="38" y="90" />
        </clipPath>
      </defs>

      <Part name="shadow" pivot={[60, 115.5]}>
        <ellipse cx="60" cy="115.5" fill="#000" opacity=".12" rx="24" ry="3.6" />
      </Part>
      <Part name="feet" pivot={[60, 110]}>
        <rect fill="#7c86c4" height="9" rx="4.5" width="12" x="45" y="106" />
        <rect fill="#7c86c4" height="9" rx="4.5" width="12" x="63" y="106" />
      </Part>
      <Part name="body" pivot={[60, 112]}>
        <Part name="arm-left" pivot={[36, 94]}>
          <rect
            fill="#b3bbe6"
            height="17"
            rx="5"
            transform="rotate(24 33 101)"
            width="10"
            x="28"
            y="93"
          />
        </Part>
        <Part name="arm-right" pivot={[84, 94]}>
          <rect
            fill="#b3bbe6"
            height="17"
            rx="5"
            transform="rotate(-24 87 101)"
            width="10"
            x="82"
            y="93"
          />
        </Part>
        <Part name="torso" pivot={[60, 101]}>
          <rect fill={metal} height="22" rx="10" width="44" x="38" y="90" />
          <g clipPath={buddyDefUrl(uid, "beep-belt")}>
            <rect height="7" style={BELT_FILL} width="60" x="30" y="98" />
            <rect
              fill="none"
              height="7"
              stroke="#000"
              strokeOpacity=".14"
              strokeWidth="1.2"
              width="60"
              x="30"
              y="98"
            />
          </g>
          <path
            d="M58.5 102.5 l-6 8.5 l3.6 1.2 l5 -7.5 z"
            stroke="#000"
            strokeOpacity=".16"
            strokeWidth="1"
            style={BELT_FILL}
          />
          <path
            d="M61.5 102.5 l6 8.5 l-3.6 1.2 l-5 -7.5 z"
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
            y="96.5"
          />
        </Part>
        <Part name="head" pivot={[60, 92]}>
          <Antenna glow={glow} isNapping={isNapping} uid={uid} />
          <rect fill={metal} height="70" rx="24" width="88" x="16" y="24" />
          <rect
            fill="none"
            height="70"
            rx="24"
            stroke="#7c86c4"
            strokeOpacity=".35"
            strokeWidth="1.4"
            width="88"
            x="16"
            y="24"
          />
          <circle cx="15" cy="60" fill="#8f98d1" r="5.5" />
          <circle cx="105" cy="60" fill="#8f98d1" r="5.5" />
          <rect
            fill="#fbfcff"
            height="54"
            rx="18"
            stroke="#9aa3d6"
            strokeOpacity=".55"
            strokeWidth="1.5"
            width="72"
            x="24"
            y="34"
          />
          <rect fill="#fff" height="3.6" opacity=".8" rx="1.8" width="26" x="30" y="27.5" />
          {face}
        </Part>
      </Part>
    </>
  );
}

import { Part } from "../_character/part";
import { BELT_FILL, type BuddyBodyProps, buddyDefId, buddyDefUrl } from "./buddy-parts";

export function NoodleBody({ face, uid }: BuddyBodyProps) {
  return (
    <>
      <defs>
        <radialGradient cx="40%" cy="30%" id={buddyDefId(uid, "noodle-shade")} r="75%">
          <stop offset="0" stopColor="#ffb3cb" />
          <stop offset="1" stopColor="#ff7aa6" />
        </radialGradient>
        <clipPath id={buddyDefId(uid, "noodle-clip")}>
          <circle cx="40" cy="46" r="22" />
          <circle cx="60" cy="37" r="25" />
          <circle cx="80" cy="46" r="22" />
          <ellipse cx="60" cy="70" rx="44" ry="37" />
        </clipPath>
      </defs>

      <Part name="shadow" pivot={[60, 113]}>
        <ellipse cx="60" cy="113" fill="#000" opacity=".08" rx="30" ry="4.5" />
      </Part>
      <Part name="feet" pivot={[60, 106]}>
        <ellipse cx="47" cy="106" fill="#e8628f" rx="9" ry="6" />
        <ellipse cx="73" cy="106" fill="#e8628f" rx="9" ry="6" />
      </Part>
      <Part name="body" pivot={[60, 108]}>
        <Part name="arm-left" pivot={[22, 70]}>
          <ellipse cx="17" cy="74" fill="#ff8fb3" rx="7" ry="9" transform="rotate(25 17 74)" />
        </Part>
        <Part name="arm-right" pivot={[98, 70]}>
          <ellipse cx="103" cy="74" fill="#ff8fb3" rx="7" ry="9" transform="rotate(-25 103 74)" />
        </Part>
        <Part name="head" pivot={[60, 104]}>
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

          {face}
        </Part>
      </Part>
    </>
  );
}

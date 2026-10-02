import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { Spark, buddyDefId, buddyDefUrl } from "./_buddy/buddy-parts";

const INK = "#2a1260";

function TricksterDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <radialGradient cx="34%" cy="28%" id={buddyDefId(uid, "skin")} r="80%">
        <stop offset="0" stopColor="#f3e9ff" />
        <stop offset=".3" stopColor="#c9aaff" />
        <stop offset=".72" stopColor="#8b5cf6" />
        <stop offset="1" stopColor="#4c1d95" />
      </radialGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id={buddyDefId(uid, "tail")}
        x1="86"
        x2="92"
        y1="92"
        y2="8"
      >
        <stop offset="0" stopColor="#8b5cf6" />
        <stop offset=".45" stopColor="#c084fc" />
        <stop offset=".8" stopColor="#ff9ad5" />
        <stop offset="1" stopColor="#ffd1ec" />
      </linearGradient>
      <linearGradient id={buddyDefId(uid, "gold")} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff0b8" />
        <stop offset="1" stopColor="#f5b52e" />
      </linearGradient>
      <clipPath id={buddyDefId(uid, "lid-left")}>
        <path d="M40 100.6 L70 98.2 L70 120 L40 120 Z" />
      </clipPath>
      <clipPath id={buddyDefId(uid, "lid-right")}>
        <path d="M70 95.4 L96 93.6 L96 118 L70 118 Z" />
      </clipPath>
    </defs>
  );
}

/** A plasma "?" tail curling out of a round comet head, with two small arms. */
function TricksterBody({ uid }: { uid: string }) {
  const tail = buddyDefUrl(uid, "tail");

  return (
    <g>
      <ellipse cx="72" cy="150" fill="#000" opacity=".22" rx="26" ry="4" />
      <path
        d="M73 34 A27 27 0 1 1 109.23 59.37 L102.51 47.67 A17 17 0 1 0 79.7 31.7 Z"
        fill={tail}
      />
      <circle cx="76.35" cy="32.85" fill={tail} r="3.55" />
      <path
        d="M105.9 53.5 C94.6 57.6 86 68 82 90"
        fill="none"
        stroke={tail}
        strokeLinecap="round"
        strokeWidth="13.5"
      />
      <path
        d="M78 27 A24 24 0 0 1 112.5 13.4"
        fill="none"
        opacity=".55"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <circle cx="131" cy="30" fill="#fff" opacity=".8" r="1.8" />
      <circle cx="126" cy="58" fill="#ffd1ec" opacity=".8" r="1.3" />
      <circle cx="64" cy="20" fill="#7cf5ff" opacity=".85" r="1.4" />
      <Spark fill="#ffd36e" size={11} x={118} y={0} />
      <ellipse cx="38" cy="124" fill="#7c3aed" rx="6.5" ry="8.5" transform="rotate(38 38 124)" />
      <ellipse cx="106" cy="124" fill="#7c3aed" rx="6.5" ry="8.5" transform="rotate(-38 106 124)" />
      <circle cx="72" cy="106" fill={buddyDefUrl(uid, "skin")} r="36" />
      <ellipse
        cx="58"
        cy="84"
        fill="#fff"
        opacity=".45"
        rx="11"
        ry="6"
        transform="rotate(-28 58 84)"
      />
      <circle cx="93" cy="92" fill="#fff" opacity=".35" r="2" />
    </g>
  );
}

/** A domino mask, one eyebrow raised and a lopsided grin with a fang. */
function SlyFace({ uid }: { uid: string }) {
  return (
    <g>
      <path
        d="M41 99 Q47 90 60 94 Q67 96.5 72 94 Q86 86 98 92 Q100 104 91 110 Q80 114.5 72.5 106.5 Q68.5 103.5 64.5 106.5 Q54 115 45 110 Q39 105 41 99 Z"
        fill={INK}
      />
      <g clipPath={buddyDefUrl(uid, "lid-left")}>
        <ellipse cx="56" cy="103" fill="#fff" rx="7.6" ry="8" />
      </g>
      <path d="M48.2 100.2 L63.8 99" stroke={INK} strokeLinecap="round" strokeWidth="2.6" />
      <circle cx="53.4" cy="104.6" fill="#16123a" r="4" />
      <circle cx="54.8" cy="103.3" fill="#fff" r="1.3" />
      <g clipPath={buddyDefUrl(uid, "lid-right")}>
        <ellipse cx="82" cy="101" fill="#fff" rx="7.6" ry="8.2" />
      </g>
      <circle cx="79.4" cy="102.6" fill="#16123a" r="4.2" />
      <circle cx="80.9" cy="101.2" fill="#fff" r="1.4" />
      <path
        d="M46 88 Q54 86.5 62 89.5"
        fill="none"
        stroke={INK}
        strokeLinecap="round"
        strokeWidth="3.2"
      />
      <path
        d="M74 84 Q82 75.5 92 81"
        fill="none"
        stroke={INK}
        strokeLinecap="round"
        strokeWidth="3.2"
      />
      <path
        d="M52 119 Q68 132 90 114 Q71 124.5 52 119 Z"
        fill={INK}
        stroke={INK}
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M59.5 122.6 L62 128 L65 123.6 Z" fill="#fff" />
      <path
        d="M88 111.5 Q92 111 93 108"
        fill="none"
        stroke={INK}
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </g>
  );
}

function Crown({ uid }: { uid: string }) {
  return (
    <g transform="rotate(-20 51 66) translate(36 55) scale(0.75)">
      <path
        d="M5 25 L3 8 L12.5 16 L20 3.5 L27.5 16 L37 8 L35 25 Z"
        fill={buddyDefUrl(uid, "gold")}
        stroke="#c7861c"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <rect
        fill="#f7c24a"
        height="6"
        rx="2"
        stroke="#c7861c"
        strokeWidth="1.6"
        width="31"
        x="4.5"
        y="21.5"
      />
      <circle cx="3" cy="8" fill="#7cf5ff" r="2.6" />
      <circle cx="37" cy="8" fill="#7cf5ff" r="2.6" />
      <circle cx="20" cy="3.5" fill="#ff7ac6" r="3" />
      <circle cx="20" cy="24.5" fill="#ff7ac6" r="2" />
    </g>
  );
}

/** The "?" sign on a stick he holds up when he's the star of the card. */
function QuestionSign() {
  return (
    <g>
      <g transform="rotate(-14 30 120)">
        <path d="M30 124 V104" stroke="#c4b5fd" strokeLinecap="round" strokeWidth="3" />
        <circle cx="30" cy="96" fill="#fbfaff" r="13" stroke="#c4b5fd" strokeWidth="1.8" />
        <path
          d="M25.5 92.5 C25.5 86.5 34.5 86.5 34.5 92 C34.5 95.5 30 96 30 99.5"
          fill="none"
          stroke="#7c3aed"
          strokeLinecap="round"
          strokeWidth="2.6"
        />
        <circle cx="30" cy="103.5" fill="#7c3aed" r="1.6" />
      </g>
      <ellipse cx="34" cy="121" fill="#7c3aed" rx="6.5" ry="7" />
    </g>
  );
}

/**
 * The Trickster, Fun mode's boss: a sly comet with a "?" tail and a crown he
 * hasn't earned. `hero` holds up a "?" sign. Pass a translated `label` so he's
 * announced as an image; omit it when adjacent text already names him.
 */
function Trickster({
  className,
  label,
  pose = "sly",
  ...props
}: Omit<React.ComponentProps<"svg">, "children"> & { label?: string; pose?: "hero" | "sly" }) {
  const uid = useId().replaceAll(/[^\w-]/gu, "");

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("size-24 shrink-0 overflow-visible", className)}
      data-slot="trickster"
      focusable="false"
      role={label ? "img" : undefined}
      viewBox="0 0 160 160"
      {...props}
    >
      <TricksterDefs uid={uid} />
      <TricksterBody uid={uid} />
      {pose === "hero" && <QuestionSign />}
      <SlyFace uid={uid} />
      <Crown uid={uid} />
    </svg>
  );
}

export { Trickster };

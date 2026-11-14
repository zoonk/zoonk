import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { buddyDefId, buddyDefUrl } from "./_buddy/buddy-parts";
import { type CharacterView, Part, type PartPose } from "./_character/part";

const INK = "#2a1260";
const PUPIL = "#16123a";

export type TricksterExpression = "sly" | "smug" | "defeated";

export type TricksterPart =
  | "arm-left"
  | "arm-right"
  | "body"
  | "crown"
  | "shield-fracture"
  | "shield-left"
  | "shield-right"
  | "tail";

export const TRICKSTER_POSES: Record<
  TricksterExpression,
  Partial<Record<TricksterPart, PartPose>>
> = {
  defeated: {
    "arm-left": { rotate: -22 },
    "arm-right": { rotate: 22 },
    body: { rotate: 5, scale: [1.03, 0.95] },
    crown: { rotate: -18, translate: [-3, 8] },
    "shield-fracture": { opacity: 1 },
    "shield-left": { rotate: -70, translate: [5, 21] },
    "shield-right": { rotate: 82, translate: [16, 24] },
    tail: { rotate: 16 },
  },
  sly: { "shield-fracture": { opacity: 0 } },
  smug: { crown: { rotate: -7 }, "shield-fracture": { opacity: 0 }, tail: { rotate: -5 } },
};

const LIDS: Record<TricksterExpression, { left: string; right: string }> = {
  defeated: {
    left: "M40 104.6 L70 100.4 L70 120 L40 120 Z",
    right: "M70 96.2 L96 100.6 L96 118 L70 118 Z",
  },
  sly: {
    left: "M40 100.6 L70 98.2 L70 120 L40 120 Z",
    right: "M70 95.4 L96 93.6 L96 118 L70 118 Z",
  },
  smug: {
    left: "M40 102.6 L70 100.4 L70 120 L40 120 Z",
    right: "M70 98 L96 96.4 L96 118 L70 118 Z",
  },
};

const EXPRESSIONS: readonly TricksterExpression[] = ["sly", "smug", "defeated"];

const SHIELD_RIM =
  "M9.3 98.4 Q29 92 48.7 98.4 L48.7 115.2 Q48.7 132.6 29 143 Q9.3 132.6 9.3 115.2 Z";

const SHIELD_FACE =
  "M13.9 102 Q29 97.3 44.1 102 L44.1 115.2 Q44.1 129.1 29 137.7 Q13.9 129.1 13.9 115.2 Z";

const SHIELD_FRACTURE = "M30.9 93.6 L26.1 103.6 L32.5 112.9 L24.9 123.3 L28.8 141.8";

/** The halves overlap by a hair along the fracture, so the whole shield shows no seam. */
const SHIELD_HALVES = {
  left: "M0 86 L31.6 86 L31.6 90.8 L26.4 103.6 L32.8 112.9 L25.2 123.3 L29.3 145.4 L29.3 150 L0 150 Z",
  right:
    "M60 86 L31 86 L31 90.8 L25.8 103.6 L32.2 112.9 L24.6 123.3 L28.7 145.4 L28.7 150 L60 150 Z",
};

/** A right answer cracks the shield: the first mark, then the second. */
const SHIELD_CRACKS = [
  "M42.5 96.9 L38.3 103.1 L41.3 108.2",
  "M9.7 121.5 L16 119.4 L15.3 114 L19.3 112",
];

const NO_SWAPS: readonly TricksterExpression[] = [];

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
      <clipPath id={buddyDefId(uid, "shield-left")}>
        <path d={SHIELD_HALVES.left} />
      </clipPath>
      <clipPath id={buddyDefId(uid, "shield-right")}>
        <path d={SHIELD_HALVES.right} />
      </clipPath>
      <clipPath id={buddyDefId(uid, "shield")}>
        <path d={SHIELD_RIM} />
      </clipPath>
      {EXPRESSIONS.map((expression) => (
        <g key={expression}>
          <clipPath id={buddyDefId(uid, `lid-left-${expression}`)}>
            <path d={LIDS[expression].left} />
          </clipPath>
          <clipPath id={buddyDefId(uid, `lid-right-${expression}`)}>
            <path d={LIDS[expression].right} />
          </clipPath>
        </g>
      ))}
    </defs>
  );
}

function Tail({ uid }: { uid: string }) {
  const tail = buddyDefUrl(uid, "tail");

  return (
    <>
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
    </>
  );
}

function MaskEye({
  expression,
  glint,
  lid,
  pupil,
  side,
  uid,
  white,
}: {
  expression: TricksterExpression;
  glint: readonly [cx: number, cy: number, radius: number];
  lid?: string;
  pupil: readonly [cx: number, cy: number, radius: number];
  side: "left" | "right";
  uid: string;
  white: readonly [cx: number, cy: number, rx: number, ry: number];
}) {
  return (
    <Part name={`eye-${side}`} pivot={[white[0], white[1]]}>
      <g clipPath={buddyDefUrl(uid, `lid-${side}-${expression}`)}>
        <ellipse cx={white[0]} cy={white[1]} fill="#fff" rx={white[2]} ry={white[3]} />
      </g>
      {lid && <path d={lid} stroke={INK} strokeLinecap="round" strokeWidth="2.6" />}
      <Part name={`pupil-${side}`} pivot={[pupil[0], pupil[1]]}>
        <circle cx={pupil[0]} cy={pupil[1]} fill={PUPIL} r={pupil[2]} />
        <circle cx={glint[0]} cy={glint[1]} fill="#fff" r={glint[2]} />
      </Part>
    </Part>
  );
}

function Brow({ path, side }: { path: string; side: "left" | "right" }) {
  return (
    <Part name={`brow-${side}`} pivot={side === "left" ? [54, 88] : [83, 81]}>
      <path d={path} fill="none" stroke={INK} strokeLinecap="round" strokeWidth="3.2" />
    </Part>
  );
}

function Mask() {
  return (
    <Part name="mask" pivot={[70, 102]}>
      <path
        d="M41 99 Q47 90 60 94 Q67 96.5 72 94 Q86 86 98 92 Q100 104 91 110 Q80 114.5 72.5 106.5 Q68.5 103.5 64.5 106.5 Q54 115 45 110 Q39 105 41 99 Z"
        fill={INK}
      />
    </Part>
  );
}

function Grin({ cheek, fang, grin }: { cheek: string; fang: string; grin: string }) {
  return (
    <Part name="mouth" pivot={[70, 120]}>
      <path d={grin} fill={INK} stroke={INK} strokeLinejoin="round" strokeWidth="2" />
      <path d={fang} fill="#fff" />
      <path d={cheek} fill="none" stroke={INK} strokeLinecap="round" strokeWidth="2.4" />
    </Part>
  );
}

function SlyFace({ uid }: { uid: string }) {
  return (
    <>
      <Mask />
      <MaskEye
        expression="sly"
        glint={[54.8, 103.3, 1.3]}
        lid="M48.2 100.2 L63.8 99"
        pupil={[53.4, 104.6, 4]}
        side="left"
        uid={uid}
        white={[56, 103, 7.6, 8]}
      />
      <MaskEye
        expression="sly"
        glint={[80.9, 101.2, 1.4]}
        pupil={[79.4, 102.6, 4.2]}
        side="right"
        uid={uid}
        white={[82, 101, 7.6, 8.2]}
      />
      <Brow path="M46 88 Q54 86.5 62 89.5" side="left" />
      <Brow path="M74 84 Q82 75.5 92 81" side="right" />
      <Grin
        cheek="M88 111.5 Q92 111 93 108"
        fang="M59.5 122.6 L62 128 L65 123.6 Z"
        grin="M52 119 Q68 132 90 114 Q71 124.5 52 119 Z"
      />
    </>
  );
}

function SmugFace({ uid }: { uid: string }) {
  return (
    <>
      <Mask />
      <MaskEye
        expression="smug"
        glint={[58.4, 103.6, 1.3]}
        lid="M48.2 102.2 L63.8 101.2"
        pupil={[57, 105, 4]}
        side="left"
        uid={uid}
        white={[56, 103, 7.6, 8]}
      />
      <MaskEye
        expression="smug"
        glint={[84.5, 101.6, 1.4]}
        lid="M74.5 97.6 L89.5 96.6"
        pupil={[83, 103, 4.2]}
        side="right"
        uid={uid}
        white={[82, 101, 7.6, 8.2]}
      />
      <Brow path="M46 89.5 Q54 88.5 62 91" side="left" />
      <Brow path="M74 82.5 Q82 72.5 92 79" side="right" />
      <Grin
        cheek="M90.5 109.5 Q94.5 109 95.5 105.5"
        fang="M58.5 122.4 L61 128 L64 123.4 Z"
        grin="M50 118.5 Q68 133.5 92.5 111.5 Q71 125.5 50 118.5 Z"
      />
    </>
  );
}

function DefeatedFace({ uid }: { uid: string }) {
  return (
    <>
      <Mask />
      <MaskEye
        expression="defeated"
        glint={[56.4, 106.3, 1.3]}
        lid="M47.6 103.7 L63.6 101.5"
        pupil={[55, 107.5, 4]}
        side="left"
        uid={uid}
        white={[56, 103, 7.6, 8]}
      />
      <MaskEye
        expression="defeated"
        glint={[82.4, 104.8, 1.4]}
        lid="M74.6 97.4 L89.6 99.9"
        pupil={[81, 106, 4.2]}
        side="right"
        uid={uid}
        white={[82, 101, 7.6, 8.2]}
      />
      <Brow path="M45 92.5 Q53 89.5 61.5 85.5" side="left" />
      <Brow path="M75 82 Q83 82.5 92 87.5" side="right" />
      <Part name="mouth" pivot={[70, 121]}>
        <path
          d="M56 123.5 Q60.5 119 65 122 Q70 125.5 75 121.5 Q80 118 85.5 122.5"
          fill="none"
          stroke={INK}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      </Part>
      <Part name="sweat" pivot={[104, 84]}>
        <path
          d="M104 77 Q99.2 84.4 101.4 87 Q104 89.4 106.6 87 Q108.8 84.4 104 77 Z"
          fill="#a8ddff"
        />
        <circle cx="102.6" cy="85.2" fill="#fff" opacity=".8" r="1" />
      </Part>
    </>
  );
}

function FaceDrawing({ expression, uid }: { expression: TricksterExpression; uid: string }) {
  switch (expression) {
    case "defeated":
      return <DefeatedFace uid={uid} />;
    case "smug":
      return <SmugFace uid={uid} />;
    case "sly":
      return <SlyFace uid={uid} />;
    default:
      return null;
  }
}

function TricksterFace({
  expression,
  hidden = false,
  uid,
}: {
  expression: TricksterExpression;
  hidden?: boolean;
  uid: string;
}) {
  return (
    <g data-face={expression} opacity={hidden ? 0 : undefined}>
      <FaceDrawing expression={expression} uid={uid} />
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

function ShieldCrack({ path }: { path: string }) {
  return (
    <path
      d={path}
      fill="none"
      stroke={INK}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  );
}

function ShieldDrawing({
  cracks,
  fracture,
  uid,
}: {
  cracks: number;
  fracture?: PartPose;
  uid: string;
}) {
  return (
    <>
      <path
        d={SHIELD_RIM}
        fill={buddyDefUrl(uid, "gold")}
        stroke="#c7861c"
        strokeLinejoin="round"
        strokeWidth="2.1"
      />
      <path
        d={SHIELD_FACE}
        fill="#f3edff"
        stroke="#c7861c"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M23.9 110.6 C23.9 103.8 34.1 103.8 34.1 110.1 C34.1 114 29 114.5 29 118.4"
        fill="none"
        stroke="#7c3aed"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle cx="29" cy="123.6" fill="#7c3aed" r="1.9" />
      <path
        d="M12.3 100.6 Q19.7 98 26.7 97.1"
        fill="none"
        opacity=".75"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      {SHIELD_CRACKS.slice(0, cracks).map((path) => (
        <ShieldCrack key={path} path={path} />
      ))}
      <Part name="shield-fracture" pivot={[29, 117.5]} pose={fracture}>
        <ShieldCrack path={SHIELD_FRACTURE} />
      </Part>
    </>
  );
}

/**
 * His shield, in two halves that sit together until he is beaten. Each half carries the whole
 * drawing behind its own clip, so the pieces keep their marks as they fall apart.
 */
function Shield({
  cracks,
  parts,
  uid,
}: {
  cracks: number;
  parts: Partial<Record<TricksterPart, PartPose>>;
  uid: string;
}) {
  return (
    <Part name="shield" pivot={[29, 117.5]}>
      <Part name="shield-left" pivot={[18.6, 116.4]} pose={parts["shield-left"]}>
        <g clipPath={buddyDefUrl(uid, "shield-left")}>
          <ShieldDrawing cracks={cracks} fracture={parts["shield-fracture"]} uid={uid} />
        </g>
      </Part>
      <Part name="shield-right" pivot={[39.4, 116.4]} pose={parts["shield-right"]}>
        <g clipPath={buddyDefUrl(uid, "shield-right")}>
          <ShieldDrawing cracks={cracks} fracture={parts["shield-fracture"]} uid={uid} />
        </g>
      </Part>
      <g clipPath={buddyDefUrl(uid, "shield")}>
        <Part name="shield-glint" pivot={[29, 117.5]} pose={{ opacity: 0 }}>
          <path d="M22 88 L31 88 L21 148 L12 148 Z" fill="#fff" />
        </Part>
      </g>
    </Part>
  );
}

export type TricksterProps = Omit<React.ComponentProps<"svg">, "children"> & {
  expression?: TricksterExpression;
  /** The marks right answers have left on his shield, before the one that breaks it. */
  cracks?: 0 | 1 | 2;
  label?: string;
  view?: CharacterView;
};

/** As the buddy's: a view's picture holds everything that view draws, in every expression. */
const BODY_BOX = "0 0 160 160";
const FACE_BOX = "25.5 51.5 93 93";

export function TricksterFigure({
  className,
  cracks = 0,
  expression = "sly",
  label,
  swapFaces = NO_SWAPS,
  view = "body",
  ...props
}: TricksterProps & { swapFaces?: readonly TricksterExpression[] }) {
  const uid = useId().replaceAll(/[^\w-]/gu, "");
  const parts = TRICKSTER_POSES[expression];
  const whole = view === "body";

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("size-24 shrink-0 overflow-visible", className)}
      data-slot="trickster"
      focusable="false"
      role={label ? "img" : undefined}
      viewBox={whole ? BODY_BOX : FACE_BOX}
      {...props}
    >
      <TricksterDefs uid={uid} />
      {whole && (
        <Part name="shadow" pivot={[72, 150]}>
          <ellipse cx="72" cy="150" fill="#000" opacity=".22" rx="26" ry="4" />
        </Part>
      )}
      <Part name="body" pivot={[72, 142]} pose={parts.body}>
        {whole && (
          <>
            <Part name="arm-left" pivot={[46, 116]} pose={parts["arm-left"]}>
              <ellipse
                cx="38"
                cy="124"
                fill="#7c3aed"
                rx="6.5"
                ry="8.5"
                transform="rotate(38 38 124)"
              />
            </Part>
            <Part name="arm-right" pivot={[98, 116]} pose={parts["arm-right"]}>
              <ellipse
                cx="106"
                cy="124"
                fill="#7c3aed"
                rx="6.5"
                ry="8.5"
                transform="rotate(-38 106 124)"
              />
            </Part>
          </>
        )}
        <Part name="head" pivot={[72, 140]}>
          {whole && (
            <Part name="tail" pivot={[86, 88]} pose={parts.tail}>
              <Tail uid={uid} />
            </Part>
          )}
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
          <Part name="face" pivot={[70, 104]}>
            <TricksterFace expression={expression} uid={uid} />
            {swapFaces
              .filter((swapped) => swapped !== expression)
              .map((swapped) => (
                <TricksterFace expression={swapped} hidden key={swapped} uid={uid} />
              ))}
          </Part>
          <Part name="crown" pivot={[51, 66]} pose={parts.crown}>
            <Crown uid={uid} />
          </Part>
        </Part>
      </Part>
      {whole && <Shield cracks={cracks} parts={parts} uid={uid} />}
    </svg>
  );
}

/** Omit `label` only when adjacent text already names him. */
function Trickster(props: TricksterProps) {
  return <TricksterFigure {...props} />;
}

export { Trickster };

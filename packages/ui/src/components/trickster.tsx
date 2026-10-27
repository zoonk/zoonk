import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { buddyDefId, buddyDefUrl } from "./_buddy/buddy-parts";
import { Part, type PartPose } from "./_character/part";

const INK = "#2a1260";
const PUPIL = "#16123a";

/** How the Trickster feels: sly while he runs a challenge, smug when he scores, defeated when beaten. */
export type TricksterExpression = "sly" | "smug" | "defeated";

/** The parts an expression poses beyond his face, by their `data-part`. */
export type TricksterPart = "arm-left" | "arm-right" | "body" | "crown" | "tail";

/**
 * Each expression's pose, one source for the still drawing and for the acts that reach it. Sly is
 * his rest. Smug cocks his crown and curls his tail. Defeated slumps: shorter and wider, leaning
 * back, the crown slipping over his brow, the tail wilting and the arms hanging.
 */
export const TRICKSTER_POSES: Record<
  TricksterExpression,
  Partial<Record<TricksterPart, PartPose>>
> = {
  defeated: {
    "arm-left": { rotate: -22 },
    "arm-right": { rotate: 22 },
    body: { rotate: 5, scale: [1.03, 0.95] },
    crown: { rotate: -18, translate: [-3, 8] },
    tail: { rotate: 16 },
  },
  sly: {},
  smug: { crown: { rotate: -7 }, tail: { rotate: -5 } },
};

/** The upper lids, as each eye's clip: their top edge is the lid. */
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

/** A plasma "?" tail curling out of his head. */
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

/** One eye under its lid, with the pupil and glint a glance moves as one. */
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

/** The domino mask he wears in every mood. */
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

/** A lopsided grin with a fang, and the dimple at its high corner. */
function Grin({ cheek, fang, grin }: { cheek: string; fang: string; grin: string }) {
  return (
    <Part name="mouth" pivot={[70, 120]}>
      <path d={grin} fill={INK} stroke={INK} strokeLinejoin="round" strokeWidth="2" />
      <path d={fang} fill="#fff" />
      <path d={cheek} fill="none" stroke={INK} strokeLinecap="round" strokeWidth="2.4" />
    </Part>
  );
}

/** One eyebrow raised and a lopsided grin with a fang: his face while he runs a challenge. */
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

/** Pleased with himself: lids lower, a sidelong look, the brow higher, the grin wider. */
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

/** Beaten: brows up in the middle, heavy lids, eyes down, a wobbly mouth and a drop of sweat. */
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

/**
 * The "?" sign on a stick he holds up when he's the star of the card. It turns around his left
 * shoulder, as the arm holding it does, so an act moves both together.
 */
function QuestionSign() {
  return (
    <Part name="sign" pivot={[46, 116]}>
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
    </Part>
  );
}

export type TricksterProps = Omit<React.ComponentProps<"svg">, "children"> & {
  expression?: TricksterExpression;
  label?: string;
  pose?: "hero" | "sly";
};

/**
 * The Trickster's drawing, with the faces an act swaps in (`swapFaces`) drawn hidden over his own.
 * `Trickster` draws him still; `TricksterActor` (`@zoonk/ui/components/trickster-actor`) makes him
 * act.
 */
export function TricksterFigure({
  className,
  expression = "sly",
  label,
  pose = "sly",
  swapFaces = NO_SWAPS,
  ...props
}: TricksterProps & { swapFaces?: readonly TricksterExpression[] }) {
  const uid = useId().replaceAll(/[^\w-]/gu, "");
  const parts = TRICKSTER_POSES[expression];

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
      <Part name="shadow" pivot={[72, 150]}>
        <ellipse cx="72" cy="150" fill="#000" opacity=".22" rx="26" ry="4" />
      </Part>
      <Part name="body" pivot={[72, 142]} pose={parts.body}>
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
        <Part name="head" pivot={[72, 140]}>
          <Part name="tail" pivot={[86, 88]} pose={parts.tail}>
            <Tail uid={uid} />
          </Part>
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
          {pose === "hero" && <QuestionSign />}
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
    </svg>
  );
}

/**
 * The Trickster, the checkpoints' boss: a sly comet with a "?" tail and a crown he
 * hasn't earned. `hero` holds up a "?" sign; `expression` is how he feels (sly, smug, defeated).
 * Pass a translated `label` so he's announced as an image; omit it when adjacent text already
 * names him. He holds still: a character never moves as one block, and only `TricksterActor`
 * makes his parts act.
 */
function Trickster(props: TricksterProps) {
  return <TricksterFigure {...props} />;
}

export { Trickster };

import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";
import {
  type BuddyEnergyState,
  type BuddyGlasses,
  type BuddyKind,
  type BuddyStage,
  getBuddyEnergyState,
  getBuddyGlow,
  getBuddyStage,
} from "@zoonk/utils/buddy";
import { useId } from "react";
import { BeepBody } from "./_buddy/beep";
import { type BuddyExpression, BuddyFace, SLEEPY_EYES_OFFSET } from "./_buddy/buddy-face";
import { BuddyGlassesFrame } from "./_buddy/buddy-glasses";
import { type BuddyBodyProps, Spark, buddyDefId, buddyDefUrl } from "./_buddy/buddy-parts";
import { NoodleBody } from "./_buddy/noodle";
import { OttoBody } from "./_buddy/otto";
import { ZuBody } from "./_buddy/zu";

export type { BuddyExpression } from "./_buddy/buddy-face";

/** Buddies grow with the belts: 70% as a baby, 85% young, full size as an adult or wise. */
const STAGE_SCALE: Record<BuddyStage, number> = { adult: 1, baby: 0.7, wise: 1, young: 0.85 };

/** Growth scales around the feet so a buddy always stands on the same ground line. */
const GROUND_X = 60;
const GROUND_Y = 116;

const EXPRESSION_BY_ENERGY: Record<BuddyEnergyState, BuddyExpression> = {
  awake: "happy",
  glowing: "cheer",
  napping: "sleepy",
};

function BuddyBody({ kind, ...props }: BuddyBodyProps & { kind: BuddyKind }) {
  switch (kind) {
    case "beep":
      return <BeepBody {...props} />;
    case "noodle":
      return <NoodleBody {...props} />;
    case "otto":
      return <OttoBody {...props} />;
    case "zu":
      return <ZuBody {...props} />;
    default:
      return null;
  }
}

/** Wise buddies (red, gray and black belts) wear a soft golden glow. */
function WiseAura({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={buddyDefId(uid, "wise-aura")}>
          <stop offset="0" stopColor="#ffd36e" stopOpacity=".38" />
          <stop offset=".6" stopColor="#ffd36e" stopOpacity=".12" />
          <stop offset="1" stopColor="#ffd36e" stopOpacity="0" />
        </radialGradient>
        <filter height="160%" id={buddyDefId(uid, "wise-glow")} width="160%" x="-30%" y="-30%">
          <feDropShadow dx="0" dy="0" floodColor="#ffd36e" floodOpacity=".45" stdDeviation="5" />
        </filter>
      </defs>
      <circle cx="60" cy="64" fill={buddyDefUrl(uid, "wise-aura")} r="62" />
      <Spark fill="#ffd36e" size={10} x={2} y={30} />
      <Spark fill="#ffd36e" size={7} x={106} y={16} />
      <Spark fill="#fff1c9" size={5} x={104} y={66} />
    </g>
  );
}

/**
 * A Fun mode buddy: Zu, Noodle, Beep or Otto. The stage comes from the belt, the
 * glow and the default expression from Energy, and every pair of glasses fits
 * every buddy. Pass a translated `label` so the buddy is announced as an image; omit
 * it only when adjacent text already names the buddy.
 */
function Buddy({
  beltColor,
  className,
  energy,
  expression,
  glasses = "round",
  kind,
  label,
  studiedToday = false,
  style,
  ...props
}: Omit<React.ComponentProps<"svg">, "children"> & {
  beltColor: BeltColor;
  energy: number;
  expression?: BuddyExpression;
  glasses?: BuddyGlasses;
  kind: BuddyKind;
  label?: string;
  /** Learning wakes the buddy: on a day with study it never naps, even while Energy is low. */
  studiedToday?: boolean;
}) {
  const uid = useId().replaceAll(/[^\w-]/gu, "");
  const stage = getBuddyStage(beltColor);
  const energyState = getBuddyEnergyState(energy, { studiedToday });
  const face = expression ?? EXPRESSION_BY_ENERGY[energyState];
  const isNapping = face === "sleepy";
  const scale = STAGE_SCALE[stage];
  const beltStyle: CSSPropertiesWithVariables = { "--buddy-belt": `var(--belt-${beltColor})` };

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("size-24 shrink-0 overflow-visible", className)}
      data-energy={energyState}
      data-buddy={kind}
      data-slot="buddy"
      data-stage={stage}
      focusable="false"
      role={label ? "img" : undefined}
      style={{ ...beltStyle, ...style }}
      viewBox="0 0 120 120"
      {...props}
    >
      {stage === "wise" && <WiseAura uid={uid} />}

      <g
        filter={stage === "wise" ? buddyDefUrl(uid, "wise-glow") : undefined}
        transform={`translate(${GROUND_X} ${GROUND_Y}) scale(${scale}) translate(${-GROUND_X} ${-GROUND_Y})`}
      >
        <BuddyBody
          glow={getBuddyGlow(energy)}
          isGlowing={energyState === "glowing"}
          isNapping={isNapping}
          kind={kind}
          uid={uid}
        />
        <BuddyFace expression={face} />
        <g transform={isNapping ? `translate(0 ${SLEEPY_EYES_OFFSET})` : undefined}>
          <BuddyGlassesFrame glasses={glasses} uid={uid} />
        </g>
      </g>
    </svg>
  );
}

export { Buddy };

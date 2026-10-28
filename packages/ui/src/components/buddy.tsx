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
import { type BuddyBodyProps } from "./_buddy/buddy-parts";
import { NoodleBody } from "./_buddy/noodle";
import { OttoBody } from "./_buddy/otto";
import { ZuBody } from "./_buddy/zu";
import { Part } from "./_character/part";

export type { BuddyExpression } from "./_buddy/buddy-face";

const STAGE_SCALE: Record<BuddyStage, number> = { adult: 1, baby: 0.7, young: 0.85 };

const GROUND_X = 60;
const GROUND_Y = 116;

const FACE_CENTER_Y = 60;
const FACE_SIZE = 96;

function getFaceViewBox(scale: number) {
  const size = FACE_SIZE * scale;
  const centerY = GROUND_Y - (GROUND_Y - FACE_CENTER_Y) * scale;

  return `${GROUND_X - size / 2} ${centerY - size / 2} ${size} ${size}`;
}

const NO_SWAPS: readonly BuddyExpression[] = [];

const EXPRESSION_BY_ENERGY: Record<BuddyEnergyState, BuddyExpression> = {
  awake: "happy",
  glowing: "cheer",
  napping: "sleepy",
};

export function getBuddyEnergyExpression({
  energy,
  studiedToday = false,
}: Pick<BuddyProps, "energy" | "studiedToday">): BuddyExpression {
  return EXPRESSION_BY_ENERGY[getBuddyEnergyState(energy, { studiedToday })];
}

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

export type BuddyProps = Omit<React.ComponentProps<"svg">, "children" | "viewBox"> & {
  beltColor: BeltColor;
  crop?: "face";
  energy: number | null;
  expression?: BuddyExpression;
  glasses?: BuddyGlasses;
  kind: BuddyKind;
  label?: string;
  /** Learning wakes the buddy: on a day with study it never naps, even while Energy is low. */
  studiedToday?: boolean;
};

export function BuddyFigure({
  beltColor,
  className,
  crop,
  energy,
  expression,
  glasses = "round",
  kind,
  label,
  studiedToday = false,
  style,
  swapFaces = NO_SWAPS,
  ...props
}: BuddyProps & { swapFaces?: readonly BuddyExpression[] }) {
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
      className={cn(
        "size-24 shrink-0",
        crop === "face" ? "overflow-hidden" : "overflow-visible",
        className,
      )}
      data-energy={energyState}
      data-buddy={kind}
      data-slot="buddy"
      data-stage={stage}
      focusable="false"
      role={label ? "img" : undefined}
      style={{ ...beltStyle, ...style }}
      viewBox={crop === "face" ? getFaceViewBox(scale) : "0 0 120 120"}
      {...props}
    >
      <g
        transform={`translate(${GROUND_X} ${GROUND_Y}) scale(${scale}) translate(${-GROUND_X} ${-GROUND_Y})`}
      >
        <BuddyBody
          face={
            <Part name="face" pivot={[60, 64]}>
              <BuddyFace expression={face} />
              {swapFaces
                .filter((swapped) => swapped !== face)
                .map((swapped) => (
                  <BuddyFace expression={swapped} hidden key={swapped} />
                ))}
              <g transform={isNapping ? `translate(0 ${SLEEPY_EYES_OFFSET})` : undefined}>
                <BuddyGlassesFrame glasses={glasses} uid={uid} />
              </g>
            </Part>
          }
          glow={getBuddyGlow(energy)}
          isNapping={isNapping}
          kind={kind}
          uid={uid}
        />
      </g>
    </svg>
  );
}

/** Omit `label` only when adjacent text already names the buddy. */
function Buddy(props: BuddyProps) {
  return <BuddyFigure {...props} />;
}

export { Buddy };

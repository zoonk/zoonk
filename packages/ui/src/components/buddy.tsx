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
import { type CharacterView, Part } from "./_character/part";

export type { BuddyExpression } from "./_buddy/buddy-face";
export type { CharacterView } from "./_character/part";

const STAGE_SCALE: Record<BuddyStage, number> = { adult: 1, baby: 0.7, young: 0.85 };

const GROUND_X = 60;
const GROUND_Y = 116;

/**
 * A view's picture holds everything that view draws, for every buddy, stage, face, glasses and
 * Energy, with 2 units to spare, so its edge never cuts the buddy and a change of state moves
 * nothing. The body's is 6:7, so give it a height; a face's is square, and has no stage, snore,
 * monocle chain or growing glow.
 */
const BODY_BOX = "0 -18 120 140";

const FACE_BOX: Record<BuddyKind, string> = {
  beep: "7 -5.5 106 106",
  noodle: "10 9.6 100 100",
  otto: "14 8 92 92",
  zu: "13.5 -1.75 93 93",
};

const VIEW_CLASS: Record<CharacterView, string> = { body: "h-28 w-auto", face: "size-8" };

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
  energy: number | null;
  expression?: BuddyExpression;
  glasses?: BuddyGlasses;
  kind: BuddyKind;
  label?: string;
  /** Learning wakes the buddy: on a day with study it never naps, even while Energy is low. */
  studiedToday?: boolean;
  view?: CharacterView;
};

export function BuddyFigure({
  beltColor,
  className,
  energy,
  expression,
  glasses = "round",
  kind,
  label,
  studiedToday = false,
  style,
  swapFaces = NO_SWAPS,
  view = "body",
  ...props
}: BuddyProps & { swapFaces?: readonly BuddyExpression[] }) {
  const uid = useId().replaceAll(/[^\w-]/gu, "");
  const stage = getBuddyStage(beltColor);
  const energyState = getBuddyEnergyState(energy, { studiedToday });
  const face = expression ?? EXPRESSION_BY_ENERGY[energyState];
  const isNapping = face === "sleepy";
  const whole = view === "body";
  const scale = whole ? STAGE_SCALE[stage] : 1;
  const beltStyle: CSSPropertiesWithVariables = { "--buddy-belt": `var(--belt-${beltColor})` };

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("shrink-0 overflow-visible", VIEW_CLASS[view], className)}
      data-energy={energyState}
      data-buddy={kind}
      data-slot="buddy"
      data-stage={stage}
      focusable="false"
      role={label ? "img" : undefined}
      style={{ ...beltStyle, ...style }}
      viewBox={whole ? BODY_BOX : FACE_BOX[kind]}
      {...props}
    >
      <g
        transform={`translate(${GROUND_X} ${GROUND_Y}) scale(${scale}) translate(${-GROUND_X} ${-GROUND_Y})`}
      >
        <BuddyBody
          face={
            <Part name="face" pivot={[60, 64]}>
              <BuddyFace expression={face} snores={whole} />
              {swapFaces
                .filter((swapped) => swapped !== face)
                .map((swapped) => (
                  <BuddyFace expression={swapped} hidden key={swapped} snores={whole} />
                ))}
              <g transform={isNapping ? `translate(0 ${SLEEPY_EYES_OFFSET})` : undefined}>
                <BuddyGlassesFrame chain={whole} glasses={glasses} uid={uid} />
              </g>
            </Part>
          }
          glow={getBuddyGlow(energy)}
          isNapping={isNapping}
          kind={kind}
          uid={uid}
          view={view}
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

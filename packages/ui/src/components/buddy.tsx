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

/**
 * Each kind's and stage's drawn outline over every face, pair of glasses and Energy, with 2 units
 * clear, for `fit="ink"`. Measured from the drawings, so a new buddy, a stage or anything worn
 * means measuring again.
 */
const BODY_INK: Record<BuddyKind, Record<BuddyStage, readonly [number, number, number, number]>> = {
  beep: { adult: [7, -16, 108, 137.5], baby: [22, 23, 77.5, 97.5], young: [15, 3, 92.5, 118] },
  noodle: { adult: [7, 6, 108, 114], baby: [22.5, 38, 77, 81], young: [15, 22, 92.5, 97.5] },
  otto: { adult: [9, 6, 106, 116], baby: [24, 38, 75.5, 83], young: [16.5, 22, 91, 99] },
  zu: { adult: [7, -18, 108, 139], baby: [22.5, 22, 77, 98], young: [15, 2, 92.5, 119] },
};

const BODY_BOX_HEIGHT = 140;

/** The outline at the scale the body's own picture has at `--buddy-height`, so only its box changes. */
function inkPicture([x, y, width, height]: readonly [number, number, number, number]) {
  return {
    style: {
      height: `calc(var(--buddy-height, 7rem) * ${height / BODY_BOX_HEIGHT})`,
      width: `calc(var(--buddy-height, 7rem) * ${width / BODY_BOX_HEIGHT})`,
    },
    viewBox: `${x} ${y} ${width} ${height}`,
  };
}

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
  /**
   * The body's picture. `frame`: one box for every buddy and stage, so switching between them
   * moves nothing (a picker). `ink`: the buddy's own drawn outline, where it stands alone and has
   * to sit in the middle of its place; its size comes from `--buddy-height`, the height `frame`
   * would have.
   */
  fit?: "frame" | "ink";
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
  fit = "frame",
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
  const ink = whole && fit === "ink" ? inkPicture(BODY_INK[kind][stage]) : null;

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("shrink-0 overflow-visible", !ink && VIEW_CLASS[view], className)}
      data-energy={energyState}
      data-buddy={kind}
      data-slot="buddy"
      data-stage={stage}
      focusable="false"
      role={label ? "img" : undefined}
      style={{ ...beltStyle, ...ink?.style, ...style }}
      viewBox={ink?.viewBox ?? (whole ? BODY_BOX : FACE_BOX[kind])}
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

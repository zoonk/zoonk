import { Part } from "../_character/part";

/**
 * Every buddy shares one face layout (eyes at x 44 and 76, y 58; mouth near y 80),
 * which is why every expression and every pair of glasses fits every buddy. Each face is drawn as
 * parts an act moves (`eye-left`, `pupil-left`, `lid-left`, `brow-left`, `mouth` and their right
 * twins), and expressions swap whole faces, as a 2D animator replaces a drawing.
 */
export type BuddyExpression =
  | "neutral"
  | "happy"
  | "cheer"
  | "proud"
  | "wow"
  | "think"
  | "kind"
  | "sleepy";

const INK = "#221b52";
const PUPIL = "#16123a";

/** Where each eye turns and closes: a lid comes down further than the lower one comes up. */
const EYE_PIVOTS = { left: [44, 61], right: [76, 61] } as const;

type Side = "left" | "right";

/**
 * An open eye: its white, then the pupil with its glint, which a glance moves as one, and the line
 * a blink shows while the eye is closed.
 */
function OpenEye({
  glint,
  pupil,
  side,
  white,
}: {
  glint: { cx: number; cy: number; radius: number };
  pupil: { cx: number; cy: number; radius: number };
  side: Side;
  white: { cx: number; cy: number; rx: number; ry: number };
}) {
  return (
    <Part name={`eye-${side}`} pivot={EYE_PIVOTS[side]}>
      <ellipse cx={white.cx} cy={white.cy} fill="#fff" rx={white.rx} ry={white.ry} />
      <Part name={`pupil-${side}`} pivot={[pupil.cx, pupil.cy]}>
        <circle cx={pupil.cx} cy={pupil.cy} fill={PUPIL} r={pupil.radius} />
        <circle cx={glint.cx} cy={glint.cy} fill="#fff" r={glint.radius} />
      </Part>
    </Part>
  );
}

/** The lids' line while a blink holds the eyes shut: drawn only by an act. */
function BlinkLids() {
  return (
    <>
      <Part hidden name="lid-left" pivot={EYE_PIVOTS.left}>
        <path
          d="M36 61 Q44 64 52 61"
          fill="none"
          stroke={PUPIL}
          strokeLinecap="round"
          strokeWidth="3.2"
        />
      </Part>
      <Part hidden name="lid-right" pivot={EYE_PIVOTS.right}>
        <path
          d="M68 61 Q76 64 84 61"
          fill="none"
          stroke={PUPIL}
          strokeLinecap="round"
          strokeWidth="3.2"
        />
      </Part>
    </>
  );
}

function OpenEyes() {
  return (
    <>
      <OpenEye
        glint={{ cx: 47, cy: 57.5, radius: 1.9 }}
        pupil={{ cx: 45, cy: 60, radius: 5.4 }}
        side="left"
        white={{ cx: 44, cy: 58, rx: 8.5, ry: 9.5 }}
      />
      <OpenEye
        glint={{ cx: 79, cy: 57.5, radius: 1.9 }}
        pupil={{ cx: 77, cy: 60, radius: 5.4 }}
        side="right"
        white={{ cx: 76, cy: 58, rx: 8.5, ry: 9.5 }}
      />
      <BlinkLids />
    </>
  );
}

/** Eyes shut in a smile's squint, or in content: an arc for each. */
function ArcEyes({ left, right, width }: { left: string; right: string; width: number }) {
  return (
    <>
      <Part name="eye-left" pivot={EYE_PIVOTS.left}>
        <path d={left} fill="none" stroke={PUPIL} strokeLinecap="round" strokeWidth={width} />
      </Part>
      <Part name="eye-right" pivot={EYE_PIVOTS.right}>
        <path d={right} fill="none" stroke={PUPIL} strokeLinecap="round" strokeWidth={width} />
      </Part>
    </>
  );
}

function Mouth({ children }: { children: React.ReactNode }) {
  return (
    <Part name="mouth" pivot={[60, 80]}>
      {children}
    </Part>
  );
}

function LineMouth({ path }: { path: string }) {
  return (
    <Mouth>
      <path d={path} fill="none" stroke={INK} strokeLinecap="round" strokeWidth="3" />
    </Mouth>
  );
}

/** Soft brows over the glasses, in ink at half strength. */
function Brows({ left, right }: { left: string; right: string }) {
  return (
    <>
      <Part name="brow-left" pivot={[42, 38]}>
        <path
          d={left}
          fill="none"
          stroke={INK}
          strokeLinecap="round"
          strokeOpacity=".5"
          strokeWidth="3"
        />
      </Part>
      <Part name="brow-right" pivot={[78, 38]}>
        <path
          d={right}
          fill="none"
          stroke={INK}
          strokeLinecap="round"
          strokeOpacity=".5"
          strokeWidth="3"
        />
      </Part>
    </>
  );
}

function NeutralFace() {
  return (
    <>
      <OpenEyes />
      <LineMouth path="M55.5 81 Q60 82.6 64.5 81" />
    </>
  );
}

function HappyFace() {
  return (
    <>
      <OpenEyes />
      <LineMouth path="M54 79 Q60 85 66 79" />
    </>
  );
}

function CheerFace() {
  return (
    <>
      <ArcEyes left="M37 60 Q44 51 51 60" right="M69 60 Q76 51 83 60" width={3.4} />
      <Mouth>
        <path d="M52 77 Q60 90 68 77 Z" fill={INK} />
        <path d="M55.5 81 Q60 85 64.5 81" fill="#ff7ab6" />
      </Mouth>
    </>
  );
}

/** Content: eyes shut in an easy arc, brows up, a closed smile with one corner higher. */
function ProudFace() {
  return (
    <>
      <ArcEyes left="M37.5 59.5 Q44 54 50.5 59.5" right="M69.5 59.5 Q76 54 82.5 59.5" width={3.2} />
      <Brows left="M35 40.5 Q42 35.5 50 37.5" right="M85 40.5 Q78 35.5 70 37.5" />
      <LineMouth path="M52.5 79.5 Q60 86.5 68 78" />
    </>
  );
}

function WowFace() {
  return (
    <>
      <OpenEye
        glint={{ cx: 45.5, cy: 56.5, radius: 1.4 }}
        pupil={{ cx: 44, cy: 58, radius: 4 }}
        side="left"
        white={{ cx: 44, cy: 58, rx: 9.5, ry: 10.5 }}
      />
      <OpenEye
        glint={{ cx: 77.5, cy: 56.5, radius: 1.4 }}
        pupil={{ cx: 76, cy: 58, radius: 4 }}
        side="right"
        white={{ cx: 76, cy: 58, rx: 9.5, ry: 10.5 }}
      />
      <BlinkLids />
      <Mouth>
        <ellipse cx="60" cy="81" fill={INK} rx="4.2" ry="5" />
      </Mouth>
    </>
  );
}

function ThinkFace() {
  return (
    <>
      <OpenEye
        glint={{ cx: 49, cy: 53, radius: 1.7 }}
        pupil={{ cx: 47.5, cy: 55, radius: 5.2 }}
        side="left"
        white={{ cx: 44, cy: 58, rx: 8.5, ry: 9.5 }}
      />
      <OpenEye
        glint={{ cx: 81, cy: 53, radius: 1.7 }}
        pupil={{ cx: 79.5, cy: 55, radius: 5.2 }}
        side="right"
        white={{ cx: 76, cy: 58, rx: 8.5, ry: 9.5 }}
      />
      <BlinkLids />
      <LineMouth path="M55 81 Q60 79.5 66 81" />
    </>
  );
}

function KindFace() {
  return (
    <>
      <OpenEyes />
      <Brows left="M34 40 Q41 36 50 38" right="M86 40 Q79 36 70 38" />
      <LineMouth path="M55 80 Q60 83.5 65 80" />
    </>
  );
}

/** Closed eyes sit 3 units lower, so the glasses move down with them (see Buddy). */
export const SLEEPY_EYES_OFFSET = 3;

function SleepyFace() {
  return (
    <>
      <Part name="eye-left" pivot={EYE_PIVOTS.left}>
        <path
          d="M37 58 Q44 63 51 58"
          fill="none"
          stroke={PUPIL}
          strokeLinecap="round"
          strokeWidth="3.2"
          transform={`translate(0 ${SLEEPY_EYES_OFFSET})`}
        />
      </Part>
      <Part name="eye-right" pivot={EYE_PIVOTS.right}>
        <path
          d="M69 58 Q76 63 83 58"
          fill="none"
          stroke={PUPIL}
          strokeLinecap="round"
          strokeWidth="3.2"
          transform={`translate(0 ${SLEEPY_EYES_OFFSET})`}
        />
      </Part>
      <Mouth>
        <ellipse cx="60" cy="82" fill={INK} rx="3.4" ry="2.6" />
      </Mouth>
      <Part name="snore" pivot={[104, 20]}>
        <path
          d="M96 20 h8 l-8 10 h8"
          fill="none"
          stroke="#8b93c9"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.6"
        />
        <path
          d="M106 9 h6 l-6 7.5 h6"
          fill="none"
          stroke="#b3b9dd"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </Part>
    </>
  );
}

function FaceDrawing({ expression }: { expression: BuddyExpression }) {
  switch (expression) {
    case "cheer":
      return <CheerFace />;
    case "kind":
      return <KindFace />;
    case "neutral":
      return <NeutralFace />;
    case "proud":
      return <ProudFace />;
    case "sleepy":
      return <SleepyFace />;
    case "think":
      return <ThinkFace />;
    case "happy":
      return <HappyFace />;
    case "wow":
      return <WowFace />;
    default:
      return null;
  }
}

/**
 * One expression's face, named by `data-face` so an act can swap it for the next one. `hidden`
 * draws a face an act is about to swap in.
 */
export function BuddyFace({
  expression,
  hidden = false,
}: {
  expression: BuddyExpression;
  hidden?: boolean;
}) {
  return (
    <g data-face={expression} opacity={hidden ? 0 : undefined}>
      <FaceDrawing expression={expression} />
    </g>
  );
}

/**
 * Every buddy shares one face layout (eyes at x 44 and 76, y 58; mouth near y 80),
 * which is why every expression and every pair of glasses fits every buddy.
 */
export type BuddyExpression = "happy" | "cheer" | "wow" | "think" | "kind" | "sleepy";

const INK = "#221b52";
const PUPIL = "#16123a";

function OpenEyes() {
  return (
    <g>
      <ellipse cx="44" cy="58" fill="#fff" rx="8.5" ry="9.5" />
      <ellipse cx="76" cy="58" fill="#fff" rx="8.5" ry="9.5" />
      <circle cx="45" cy="60" fill={PUPIL} r="5.4" />
      <circle cx="77" cy="60" fill={PUPIL} r="5.4" />
      <circle cx="47" cy="57.5" fill="#fff" r="1.9" />
      <circle cx="79" cy="57.5" fill="#fff" r="1.9" />
    </g>
  );
}

function Mouth({ path }: { path: string }) {
  return <path d={path} fill="none" stroke={INK} strokeLinecap="round" strokeWidth="3" />;
}

function HappyFace() {
  return (
    <g>
      <OpenEyes />
      <Mouth path="M54 79 Q60 85 66 79" />
    </g>
  );
}

function CheerFace() {
  return (
    <g>
      <path
        d="M37 60 Q44 51 51 60"
        fill="none"
        stroke={PUPIL}
        strokeLinecap="round"
        strokeWidth="3.4"
      />
      <path
        d="M69 60 Q76 51 83 60"
        fill="none"
        stroke={PUPIL}
        strokeLinecap="round"
        strokeWidth="3.4"
      />
      <path d="M52 77 Q60 90 68 77 Z" fill={INK} />
      <path d="M55.5 81 Q60 85 64.5 81" fill="#ff7ab6" />
    </g>
  );
}

function WowFace() {
  return (
    <g>
      <ellipse cx="44" cy="58" fill="#fff" rx="9.5" ry="10.5" />
      <ellipse cx="76" cy="58" fill="#fff" rx="9.5" ry="10.5" />
      <circle cx="44" cy="58" fill={PUPIL} r="4" />
      <circle cx="76" cy="58" fill={PUPIL} r="4" />
      <circle cx="45.5" cy="56.5" fill="#fff" r="1.4" />
      <circle cx="77.5" cy="56.5" fill="#fff" r="1.4" />
      <ellipse cx="60" cy="81" fill={INK} rx="4.2" ry="5" />
    </g>
  );
}

function ThinkFace() {
  return (
    <g>
      <ellipse cx="44" cy="58" fill="#fff" rx="8.5" ry="9.5" />
      <ellipse cx="76" cy="58" fill="#fff" rx="8.5" ry="9.5" />
      <circle cx="47.5" cy="55" fill={PUPIL} r="5.2" />
      <circle cx="79.5" cy="55" fill={PUPIL} r="5.2" />
      <circle cx="49" cy="53" fill="#fff" r="1.7" />
      <circle cx="81" cy="53" fill="#fff" r="1.7" />
      <Mouth path="M55 81 Q60 79.5 66 81" />
    </g>
  );
}

function KindFace() {
  return (
    <g>
      <OpenEyes />
      <g fill="none" stroke={INK} strokeLinecap="round" strokeOpacity=".5" strokeWidth="3">
        <path d="M34 40 Q41 36 50 38" />
        <path d="M86 40 Q79 36 70 38" />
      </g>
      <Mouth path="M55 80 Q60 83.5 65 80" />
    </g>
  );
}

/** Closed eyes sit 3 units lower, so the glasses move down with them (see Buddy). */
export const SLEEPY_EYES_OFFSET = 3;

function SleepyFace() {
  return (
    <g>
      <g
        fill="none"
        stroke={PUPIL}
        strokeLinecap="round"
        strokeWidth="3.2"
        transform={`translate(0 ${SLEEPY_EYES_OFFSET})`}
      >
        <path d="M37 58 Q44 63 51 58" />
        <path d="M69 58 Q76 63 83 58" />
      </g>
      <ellipse cx="60" cy="82" fill={INK} rx="3.4" ry="2.6" />
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
    </g>
  );
}

export function BuddyFace({ expression }: { expression: BuddyExpression }) {
  switch (expression) {
    case "cheer":
      return <CheerFace />;
    case "kind":
      return <KindFace />;
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

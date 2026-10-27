import { type Act } from "../_character/acting";
import { type ActKey, type ActTrack } from "../_character/keyframes";
import { type BuddyExpression } from "./buddy-face";

/** The buddy's acts: each one a short performance on its parts, timed in frames at 24 a second. */
export type BuddyActName = "blink" | "cheer" | "glance" | "proud" | "smile" | "surprise";

/** A blink's lid line rests hidden; it shows only while the eyes are shut. */
const LID_REST = { opacity: 0 } as const;

/**
 * A blink starting at `from`: the lids close fast and open slower (2 frames down, 1 shut, 3 up),
 * as people blink, and the eyes shut all the way (Trutoiu et al., "Modeling and Animating Eye
 * Blinks", 2011).
 */
function blink(from: number): { eyes: ActKey[]; lids: ActKey[] } {
  return {
    eyes: [
      { at: from, scale: [1, 1] },
      { at: from + 2, ease: "accelerate", scale: [1, 0.1] },
      { at: from + 3, scale: [1, 0.1] },
      { at: from + 6, ease: "out", scale: [1, 1] },
    ],
    lids: [
      { at: from + 1.6, ease: "hold", opacity: 1 },
      { at: from + 3.4, ease: "hold", opacity: 0 },
    ],
  };
}

/** The same keys for both eyes, or both lids. */
function both(part: "eye" | "lid" | "pupil", keys: readonly ActKey[]): ActTrack[] {
  const rest = part === "lid" ? LID_REST : undefined;

  return [
    { keys, part: `${part}-left`, rest },
    { keys, part: `${part}-right`, rest },
  ];
}

/** A blink on its own: the eyes shut and open, nothing else moves. */
const BLINK: Act<BuddyExpression> = {
  frames: 6,
  tracks: [...both("eye", blink(0).eyes), ...both("lid", blink(0).lids)],
};

/**
 * A glance to the side and back: the eyes dart first (2 frames), the face slides and the head
 * turns after them, the antennae lag behind the head and swing past it, and a blink comes with the
 * return, as people blink on a big change of gaze.
 */
const GLANCE: Act<BuddyExpression> = {
  frames: 26,
  tracks: [
    ...both("pupil", [
      { at: 2, ease: "out", translate: [2.6, -0.4] },
      { at: 14, translate: [2.6, -0.4] },
      { at: 16, ease: "out", translate: [0, 0] },
    ]),
    ...both("eye", blink(15).eyes),
    ...both("lid", blink(15).lids),
    {
      keys: [
        { at: 1, translate: [0, 0] },
        { at: 8, ease: "swing", translate: [1.4, 0] },
        { at: 15, translate: [1.4, 0] },
      ],
      part: "face",
      settle: "swing",
    },
    {
      keys: [
        { at: 1, rotate: 0 },
        { at: 8, ease: "swing", rotate: 3 },
        { at: 15, rotate: 3 },
        { at: 22, ease: "swing", rotate: 0 },
      ],
      part: "head",
    },
    {
      keys: [
        { at: 3, rotate: 0 },
        { at: 8, ease: "swing", rotate: -4 },
        { at: 14, ease: "follow", rotate: 0 },
        { at: 19, ease: "swing", rotate: 3 },
      ],
      part: "antenna-left",
      settle: "follow",
    },
    {
      keys: [
        { at: 4, rotate: 0 },
        { at: 9, ease: "swing", rotate: -3.5 },
        { at: 15, ease: "follow", rotate: 0 },
        { at: 20, ease: "swing", rotate: 2.5 },
      ],
      part: "antenna-right",
      settle: "follow",
    },
    {
      keys: [
        { at: 3, rotate: 0 },
        { at: 8, ease: "swing", rotate: -4 },
        { at: 14, ease: "follow", rotate: 0 },
        { at: 19, ease: "swing", rotate: 3 },
      ],
      part: "antenna",
      settle: "follow",
    },
  ],
};

/**
 * A smile forming: the eyes lead with a slight squint, the mouth stretches and becomes a smile,
 * the head tips a little and the body lifts, the antennae following.
 */
const SMILE: Act<BuddyExpression> = {
  frames: 16,
  swapAt: 4,
  to: "happy",
  tracks: [
    ...both("eye", [
      { at: 3, ease: "swing", scale: [1, 0.86] },
      { at: 7, scale: [1, 0.9] },
    ]).map((track) => ({ ...track, settle: "spring" as const })),
    {
      keys: [
        { at: 3, ease: "accelerate", scale: [1.12, 0.7] },
        { at: 4, ease: "hold", scale: [0.82, 1.2] },
        { at: 8, ease: "out", scale: [1.06, 0.96] },
      ],
      part: "mouth",
      settle: "spring",
    },
    {
      keys: [
        { at: 2, rotate: 0 },
        { at: 7, ease: "swing", rotate: -2.5 },
        { at: 11, rotate: -2.5 },
      ],
      part: "head",
      settle: "swing",
    },
    { keys: [{ at: 6, ease: "out", scale: [0.98, 1.025] }], part: "body", settle: "spring" },
    { keys: [{ at: 7, ease: "out", rotate: -3 }], part: "antenna-left", settle: "follow" },
    { keys: [{ at: 8, ease: "out", rotate: 2.5 }], part: "antenna-right", settle: "follow" },
    { keys: [{ at: 7, ease: "out", rotate: -3 }], part: "antenna", settle: "follow" },
  ],
};

/**
 * A cheer: anticipation first (the body dips and the eyes squeeze shut), then the action (it
 * stretches up, the arms swing high, one a frame behind the other and not as far, so they never
 * mirror), the face bursts into a grin, and the follow-through: the antennae drag behind the
 * stretch and wobble before they settle, after the body has.
 */
const CHEER: Act<BuddyExpression> = {
  frames: 30,
  swapAt: 4,
  to: "cheer",
  tracks: [
    {
      keys: [
        { at: 4, ease: "accelerate", scale: [1.06, 0.88] },
        { at: 8, ease: "out", scale: [0.95, 1.08] },
        { at: 12, ease: "swing", scale: [1.03, 0.97] },
        { at: 16, ease: "swing", scale: [0.99, 1.01] },
      ],
      part: "body",
      settle: "spring",
    },
    {
      keys: [
        { at: 4, ease: "accelerate", scale: [1.08, 1] },
        { at: 8, ease: "out", scale: [0.94, 1] },
      ],
      part: "shadow",
      settle: "spring",
    },
    ...both("eye", [
      { at: 3, ease: "accelerate", scale: [1, 0.15] },
      { at: 5, scale: [1, 0.15] },
      { at: 8, ease: "out", scale: [1.06, 1.14] },
    ]).map((track) => ({ ...track, settle: "spring" as const })),
    {
      keys: [
        { at: 3, ease: "accelerate", scale: [0.8, 0.6] },
        { at: 4, ease: "hold", scale: [0.5, 0.3] },
        { at: 8, ease: "out", scale: [1.12, 1.18] },
      ],
      part: "mouth",
      settle: "spring",
    },
    {
      keys: [
        { at: 4, ease: "accelerate", rotate: -12 },
        { at: 9, ease: "out", rotate: 96 },
        { at: 13, ease: "swing", rotate: 80 },
        { at: 17, ease: "swing", rotate: 90 },
        { at: 20, rotate: 88 },
      ],
      part: "arm-left",
      settle: "swing",
    },
    {
      keys: [
        { at: 5, ease: "accelerate", rotate: 12 },
        { at: 10, ease: "out", rotate: -88 },
        { at: 14, ease: "swing", rotate: -74 },
        { at: 18, ease: "swing", rotate: -84 },
        { at: 21, rotate: -82 },
      ],
      part: "arm-right",
      settle: "swing",
    },
    {
      keys: [
        { at: 5, ease: "accelerate", rotate: 0 },
        { at: 10, ease: "out", rotate: -3 },
        { at: 18, ease: "swing", rotate: 2 },
      ],
      part: "head",
      settle: "swing",
    },
    {
      keys: [
        { at: 4, ease: "swing", rotate: 6 },
        { at: 9, ease: "out", rotate: -16 },
      ],
      part: "antenna-left",
      settle: "follow",
    },
    {
      keys: [
        { at: 5, ease: "swing", rotate: -6 },
        { at: 10, ease: "out", rotate: 15 },
      ],
      part: "antenna-right",
      settle: "follow",
    },
    {
      keys: [
        { at: 4, ease: "swing", rotate: 5 },
        { at: 9, ease: "out", rotate: -14 },
      ],
      part: "antenna",
      settle: "follow",
    },
  ],
};

/**
 * Surprise, a take: a quick dip, then the eyes pop wide and the mouth opens, the body stretches,
 * the arms lift, the antennae spring back, and a blink a moment later, while it sinks in.
 */
const SURPRISE: Act<BuddyExpression> = {
  frames: 22,
  swapAt: 3,
  to: "wow",
  tracks: [
    {
      keys: [
        { at: 2, ease: "accelerate", scale: [1.03, 0.95] },
        { at: 5, ease: "out", scale: [0.97, 1.06] },
      ],
      part: "body",
      settle: "spring",
    },
    ...both("eye", [
      { at: 2, ease: "accelerate", scale: [1, 0.8] },
      { at: 3, ease: "hold", scale: [0.9, 0.85] },
      { at: 6, ease: "out", scale: 1.12 },
      { at: 11, ease: "spring", scale: 1 },
      { at: 13, scale: [1, 1] },
      { at: 15, ease: "accelerate", scale: [1, 0.1] },
      { at: 16, scale: [1, 0.1] },
      { at: 19, ease: "out", scale: [1, 1] },
    ]),
    ...both("lid", blink(13).lids),
    {
      keys: [
        { at: 3, ease: "hold", scale: 0.4 },
        { at: 6, ease: "out", scale: 1.15 },
      ],
      part: "mouth",
      settle: "spring",
    },
    { keys: [{ at: 5, ease: "out", rotate: -2.5 }], part: "head", settle: "swing" },
    { keys: [{ at: 5, ease: "out", rotate: 22 }], part: "arm-left", settle: "swing" },
    { keys: [{ at: 6, ease: "out", rotate: -20 }], part: "arm-right", settle: "swing" },
    { keys: [{ at: 5, ease: "out", rotate: -14 }], part: "antenna-left", settle: "follow" },
    { keys: [{ at: 6, ease: "out", rotate: 13 }], part: "antenna-right", settle: "follow" },
    { keys: [{ at: 5, ease: "out", rotate: -12 }], part: "antenna", settle: "follow" },
  ],
};

/**
 * Pride: the eyes close into a content arc (the face swaps while they're shut), the chin lifts as
 * the face slides up and the head tips back, the chest fills, the brows rise last.
 */
const PROUD: Act<BuddyExpression> = {
  frames: 24,
  swapAt: 5,
  to: "proud",
  tracks: [
    ...both("eye", [
      { at: 4, ease: "accelerate", scale: [1, 0.15] },
      { at: 6, scale: [1, 0.15] },
      { at: 10, ease: "out", scale: [1, 1] },
    ]),
    {
      keys: [
        { at: 2, rotate: 0 },
        { at: 10, ease: "swing", rotate: -4 },
        { at: 17, rotate: -4 },
      ],
      part: "head",
      settle: "swing",
    },
    {
      keys: [
        { at: 3, translate: [0, 0] },
        { at: 10, ease: "swing", translate: [0, -1.5] },
        { at: 17, translate: [0, -1.5] },
      ],
      part: "face",
      settle: "swing",
    },
    { keys: [{ at: 9, ease: "out", scale: [0.98, 1.04] }], part: "body", settle: "spring" },
    {
      keys: [
        { at: 5, ease: "hold", translate: [0, 2.5] },
        { at: 11, ease: "out", translate: [0, -1.5] },
      ],
      part: "brow-left",
      settle: "spring",
    },
    {
      keys: [
        { at: 5, ease: "hold", translate: [0, 2.5] },
        { at: 12, ease: "out", translate: [0, -1.5] },
      ],
      part: "brow-right",
      settle: "spring",
    },
    {
      keys: [
        { at: 5, ease: "hold", scale: [0.8, 0.8] },
        { at: 10, ease: "out", scale: [1.06, 1] },
      ],
      part: "mouth",
      settle: "spring",
    },
    { keys: [{ at: 10, ease: "swing", rotate: 5 }], part: "antenna-left", settle: "follow" },
    { keys: [{ at: 11, ease: "swing", rotate: 4 }], part: "antenna-right", settle: "follow" },
    { keys: [{ at: 10, ease: "swing", rotate: 4 }], part: "antenna", settle: "follow" },
    { keys: [{ at: 9, ease: "swing", rotate: -10 }], part: "arm-left", settle: "swing" },
    { keys: [{ at: 10, ease: "swing", rotate: 9 }], part: "arm-right", settle: "swing" },
  ],
};

/**
 * The faces whose eyes are open, the only ones a blink can close: a reaction landing in one blinks
 * once a while later. Cheering, proud and sleepy eyes are already shut.
 */
export const BUDDY_OPEN_EYES: ReadonlySet<BuddyExpression> = new Set([
  "happy",
  "kind",
  "neutral",
  "think",
  "wow",
]);

export const BUDDY_ACTS: Record<BuddyActName, Act<BuddyExpression>> = {
  blink: BLINK,
  cheer: CHEER,
  glance: GLANCE,
  proud: PROUD,
  smile: SMILE,
  surprise: SURPRISE,
};

import { type Act } from "../_character/acting";
import { type ActTrack } from "../_character/keyframes";
import { type TricksterExpression } from "../trickster";

/** The Trickster's acts, timed in frames at 24 a second. */
export type TricksterActName = "blink" | "defeat" | "sly" | "smug";

/** Both eyes shutting together: under his mask a blink is a squash to a sliver. */
function eyes(keys: ActTrack["keys"], settle?: ActTrack["settle"]): ActTrack[] {
  return [
    { keys, part: "eye-left", settle },
    { keys, part: "eye-right", settle },
  ];
}

/** His eyes shut in 2 frames, stay shut for 1 and open in 3 (on the track's ease-out). */
const BLINK_KEYS: ActTrack["keys"] = [
  { at: 2, ease: "accelerate", scale: [1, 0.1] },
  { at: 3, scale: [1, 0.1] },
];

const BLINK: Act<TricksterExpression> = { frames: 6, tracks: eyes(BLINK_KEYS) };

/**
 * Back to sly, when the learner gets one past him: a blink, his face swapping while his eyes are
 * shut (the grin drops, the lids lift), and the crown and the tail easing back after it on their
 * loose spring. From sly it's only a blink.
 */
const SLY: Act<TricksterExpression> = {
  frames: 12,
  swapAt: 2,
  to: "sly",
  tracks: [
    ...eyes([...BLINK_KEYS, { at: 6, ease: "out", scale: [1, 1] }]),
    { keys: [], part: "crown", settle: "follow" },
    { keys: [], part: "tail", settle: "follow" },
  ],
};

/**
 * Smug: a squint that lowers his lids (the face swaps behind it), the far brow climbing, the grin
 * widening, a two-beat chuckle through the body and the arms, the crown cocked past its new angle
 * and the tail swished, both settling late on their loose spring.
 */
const SMUG: Act<TricksterExpression> = {
  frames: 22,
  swapAt: 4,
  to: "smug",
  tracks: [
    ...eyes(
      [
        { at: 3, ease: "accelerate", scale: [1, 0.7] },
        { at: 4, scale: [1, 0.7] },
      ],
      "out",
    ),
    {
      keys: [{ at: 7, ease: "out", rotate: -9, translate: [0, -4.5] }],
      part: "brow-right",
      settle: "spring",
    },
    { keys: [{ at: 7, ease: "out", translate: [0, 1] }], part: "brow-left", settle: "spring" },
    {
      keys: [
        { at: 4, ease: "hold", scale: [0.9, 0.9] },
        { at: 8, ease: "out", scale: [1.08, 1.05] },
      ],
      part: "mouth",
      settle: "spring",
    },
    {
      keys: [
        { at: 6, ease: "swing", scale: [1.04, 0.94] },
        { at: 9, ease: "swing", scale: [0.985, 1.035] },
        { at: 12, ease: "swing", scale: [1.03, 0.955] },
        { at: 15, ease: "swing", scale: [0.995, 1.01] },
      ],
      part: "body",
      settle: "spring",
    },
    {
      keys: [
        { at: 6, ease: "swing", rotate: 13 },
        { at: 9, ease: "swing", rotate: -4 },
        { at: 12, ease: "swing", rotate: 10 },
      ],
      part: "arm-left",
      settle: "swing",
    },
    {
      keys: [
        { at: 7, ease: "swing", rotate: -11 },
        { at: 10, ease: "swing", rotate: 3 },
        { at: 13, ease: "swing", rotate: -8 },
      ],
      part: "arm-right",
      settle: "swing",
    },
    { keys: [{ at: 8, ease: "out", rotate: -17 }], part: "crown", settle: "follow" },
    {
      keys: [
        { at: 5, ease: "swing", rotate: 6 },
        { at: 10, ease: "out", rotate: -15 },
      ],
      part: "tail",
      settle: "follow",
    },
  ],
};

/**
 * Defeated: a take (he stretches up, eyes wide, brows high, the crown hopping), a held beat while
 * it sinks in, then the slump. The eyes shut and the face swaps while they're closed; they open
 * slowly, sad and looking down. The body sinks past its slumped pose and settles with a sigh;
 * the arms drop a frame apart, the tail wilts and the crown slides over his brow last, each on its
 * own loose spring, so nothing stops at the same time. A drop of sweat runs down at the end.
 */
const DEFEAT: Act<TricksterExpression> = {
  frames: 42,
  swapAt: 10,
  to: "defeated",
  tracks: [
    {
      keys: [
        { at: 4, ease: "out", rotate: -1.5, scale: [0.95, 1.08] },
        { at: 9, rotate: -1.5, scale: [0.96, 1.065] },
        { at: 20, ease: "swing", rotate: 6, scale: [1.05, 0.91] },
        { at: 27, ease: "spring", rotate: 5, scale: [1.03, 0.95] },
        { at: 32, ease: "swing", rotate: 5, scale: [1.04, 0.935] },
        { at: 38, ease: "swing", rotate: 5, scale: [1.03, 0.95] },
      ],
      part: "body",
      settle: "swing",
    },
    ...eyes(
      [
        { at: 4, ease: "out", scale: 1.2 },
        { at: 8, scale: 1.15 },
        { at: 10, ease: "accelerate", scale: [1, 0.12] },
        { at: 13, scale: [1, 0.12] },
        { at: 21, ease: "swing", scale: [1, 1] },
      ],
      "out",
    ),
    {
      keys: [
        { at: 4, ease: "out", translate: [0, -4.5] },
        { at: 9, translate: [0, -4] },
        { at: 10, ease: "hold", translate: [0, -1] },
        { at: 22, ease: "swing", translate: [0, 0.5] },
      ],
      part: "brow-left",
      settle: "spring",
    },
    {
      keys: [
        { at: 4, ease: "out", translate: [0, -5] },
        { at: 9, translate: [0, -4.5] },
        { at: 10, ease: "hold", translate: [0, -1] },
        { at: 22, ease: "swing", translate: [0, 0.5] },
      ],
      part: "brow-right",
      settle: "spring",
    },
    {
      keys: [
        { at: 4, ease: "out", scale: [0.85, 1.2] },
        { at: 10, ease: "hold", scale: [0.6, 0.6] },
        { at: 19, ease: "swing", scale: [1.05, 1.1] },
      ],
      part: "mouth",
      settle: "spring",
    },
    {
      keys: [
        { at: 4, ease: "out", rotate: 14 },
        { at: 12, rotate: 10 },
        { at: 22, ease: "swing", rotate: -28 },
      ],
      part: "arm-left",
      settle: "spring",
    },
    {
      keys: [
        { at: 5, ease: "out", rotate: -14 },
        { at: 13, rotate: -10 },
        { at: 24, ease: "swing", rotate: 28 },
      ],
      part: "arm-right",
      settle: "spring",
    },
    {
      keys: [
        { at: 4, ease: "out", rotate: -10 },
        { at: 14, ease: "swing", rotate: -5 },
        { at: 26, ease: "swing", rotate: 22 },
      ],
      part: "tail",
      settle: "follow",
    },
    {
      keys: [
        { at: 4, ease: "out", rotate: -14, translate: [0, -4] },
        { at: 12, ease: "swing", rotate: -11, translate: [0, -2] },
        { at: 27, ease: "accelerate", rotate: -24, translate: [-4, 10] },
      ],
      part: "crown",
      settle: "follow",
    },
    {
      keys: [
        { at: 0, opacity: 0, translate: [0, -4] },
        { at: 28, opacity: 0, translate: [0, -4] },
        { at: 31, ease: "out", opacity: 1 },
      ],
      part: "sweat",
      settle: "swing",
    },
  ],
};

export const TRICKSTER_ACTS: Record<TricksterActName, Act<TricksterExpression>> = {
  blink: BLINK,
  defeat: DEFEAT,
  sly: SLY,
  smug: SMUG,
};

/** Every face of his shows his eyes open under the mask, so each can blink. */
export const TRICKSTER_OPEN_EYES: ReadonlySet<TricksterExpression> = new Set([
  "defeated",
  "sly",
  "smug",
]);

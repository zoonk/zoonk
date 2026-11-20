import { type Act } from "../_character/acting";
import { type ActTrack } from "../_character/keyframes";
import { type TricksterExpression } from "../trickster";

export type TricksterActName = "blink" | "defeat" | "sly" | "smug" | "triumph";

function eyes(keys: ActTrack["keys"], settle?: ActTrack["settle"]): ActTrack[] {
  return [
    { keys, part: "eye-left", settle },
    { keys, part: "eye-right", settle },
  ];
}

const BLINK_KEYS: ActTrack["keys"] = [
  { at: 2, ease: "accelerate", scale: [1, 0.1] },
  { at: 3, scale: [1, 0.1] },
];

const BLINK: Act<TricksterExpression> = { frames: 6, tracks: eyes(BLINK_KEYS) };

const SLY: Act<TricksterExpression> = {
  frames: 12,
  swapAt: 2,
  to: "sly",
  tracks: [
    ...eyes([...BLINK_KEYS, { at: 6, ease: "out", scale: [1, 1] }]),
    { keys: [], part: "crown", settle: "follow" },
    { keys: [], part: "tail", settle: "follow" },
    { keys: [{ at: 2, ease: "out", rotate: -7, scale: 0.92 }], part: "shield", settle: "spring" },
  ],
};

const CHUCKLE_LEFT_ARM: ActTrack["keys"] = [
  { at: 6, ease: "swing", rotate: 13 },
  { at: 9, ease: "swing", rotate: -4 },
  { at: 12, ease: "swing", rotate: 10 },
];

/** A wrong answer bounces off: the shield pushes out and comes back. */
const SHIELD_BLOCK: ActTrack["keys"] = [
  { at: 2, ease: "out", scale: 1.1 },
  { at: 6, ease: "spring", scale: 1 },
];

const SMUG_FACE: readonly ActTrack[] = [
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
];

const SMUG: Act<TricksterExpression> = {
  frames: 22,
  swapAt: 4,
  to: "smug",
  tracks: [
    ...SMUG_FACE,
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
    { keys: CHUCKLE_LEFT_ARM, part: "arm-left", settle: "swing" },
    { keys: [...SHIELD_BLOCK, ...CHUCKLE_LEFT_ARM], part: "shield", settle: "swing" },
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
    {
      keys: [
        { at: 2, ease: "out", scale: 1.14 },
        { at: 5, ease: "out", scale: 1 },
      ],
      part: "shield",
    },
    {
      keys: [
        { at: 1, opacity: 0 },
        { at: 2, ease: "hold", opacity: 1 },
      ],
      part: "shield-fracture",
    },
    {
      keys: [
        { at: 4, rotate: 0, translate: [0, 0] },
        { at: 9, ease: "out", rotate: -14, translate: [-6, -7] },
        { at: 17, ease: "accelerate", rotate: -74, translate: [5, 22] },
        { at: 20, ease: "out", rotate: -66, translate: [5, 19] },
        { at: 23, ease: "accelerate", rotate: -70, translate: [5, 21] },
      ],
      part: "shield-left",
      settle: "spring",
    },
    {
      keys: [
        { at: 4, rotate: 0, translate: [0, 0] },
        { at: 10, ease: "out", rotate: 18, translate: [10, -6] },
        { at: 19, ease: "accelerate", rotate: 86, translate: [16, 25] },
        { at: 22, ease: "out", rotate: 78, translate: [16, 22] },
        { at: 25, ease: "accelerate", rotate: 82, translate: [16, 24] },
      ],
      part: "shield-right",
      settle: "spring",
    },
  ],
};

/** The duel is his: the shield comes up whole, a glint runs across it, and he chuckles behind it. */
const TRIUMPH: Act<TricksterExpression> = {
  frames: 30,
  swapAt: 4,
  to: "smug",
  tracks: [
    ...SMUG_FACE,
    {
      keys: [
        { at: 8, ease: "swing", scale: [1.04, 0.94] },
        { at: 12, ease: "swing", scale: [0.985, 1.035] },
        { at: 16, ease: "swing", scale: [1.03, 0.955] },
        { at: 20, ease: "swing", scale: [0.995, 1.01] },
      ],
      part: "body",
      settle: "spring",
    },
    {
      keys: [
        ...SHIELD_BLOCK,
        { at: 6, rotate: 0, translate: [0, 0] },
        { at: 12, ease: "out", rotate: -6, translate: [2, -9] },
        { at: 22, rotate: -6, translate: [2, -9] },
      ],
      part: "shield",
      settle: "swing",
    },
    {
      keys: [
        { at: 0, opacity: 0, translate: [-26, 0] },
        { at: 11, opacity: 0, translate: [-26, 0] },
        { at: 13, ease: "out", opacity: 0.7 },
        { at: 19, ease: "swing", opacity: 0.7, translate: [30, 0] },
        { at: 21, ease: "out", opacity: 0, translate: [34, 0] },
        { at: 30, opacity: 0, translate: [34, 0] },
      ],
      part: "shield-glint",
    },
    {
      keys: [
        { at: 9, ease: "swing", rotate: -11 },
        { at: 13, ease: "swing", rotate: 3 },
        { at: 17, ease: "swing", rotate: -8 },
      ],
      part: "arm-right",
      settle: "swing",
    },
    { keys: [{ at: 10, ease: "out", rotate: -17 }], part: "crown", settle: "follow" },
    {
      keys: [
        { at: 6, ease: "swing", rotate: 6 },
        { at: 12, ease: "out", rotate: -15 },
      ],
      part: "tail",
      settle: "follow",
    },
  ],
};

export const TRICKSTER_ACTS: Record<TricksterActName, Act<TricksterExpression>> = {
  blink: BLINK,
  defeat: DEFEAT,
  sly: SLY,
  smug: SMUG,
  triumph: TRIUMPH,
};

export const TRICKSTER_OPEN_EYES: ReadonlySet<TricksterExpression> = new Set([
  "defeated",
  "sly",
  "smug",
]);

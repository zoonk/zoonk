/**
 * Motion: when things move, how, and which kinds. The values (durations, easings, the spring, the
 * keyframes and `press`) live in `packages/ui/src/styles/globals.css`, scripts read them through
 * `@zoonk/ui/lib/motion`, and the playground's `/design/motion` page moves every pattern live
 * beside these words. How to apply them: the `zoonk-motion` skill.
 */

/** How much something moves follows how often the learner meets it. */
export type MotionTier = { id: string; rules: readonly string[]; summary: string; title: string };

export const MOTION_TIERS: readonly MotionTier[] = [
  {
    id: "still",
    rules: [
      "Navigation, page loads, tabs, list rows, typing and everyday taps: the new state is simply there.",
      "Content never animates in on its own: an entrance makes a page feel slow and says nothing.",
      "Nothing loops, except a wait (a spinner, a skeleton, the saving shimmer) while it waits.",
    ],
    summary: "Everyday screens, which the learner sees many times a day.",
    title: "Still",
  },
  {
    id: "feedback",
    rules: [
      "It shows what the learner's own action did, as they do it: a press, a pick, a check turning blue, a disclosure or an overlay opening from its trigger, the lesson's screen turning.",
      "Quick (150ms) or base (200ms) on the ease-out: no spring, no overshoot, nothing to wait for.",
      "Whatever the keyboard does, and focus, changes at once.",
    ],
    summary: "Motion that answers an action, the moment it happens.",
    title: "Feedback",
  },
  {
    id: "celebration",
    rules: [
      "Only when something is earned, from the action that earned it, once: a reload, a revisit or the way back shows the end state, still.",
      "The only place for the spring, a number counting up, a meter filling from where it was and a burst. Characters hold still (Characters, below).",
      "Louder as it's rarer, and never in the learner's way: Continue works from the first frame.",
    ],
    summary:
      "The rare moments something is earned: a level, Energy, missions, a challenge won, a task's end, a milestone.",
    title: "Celebration",
  },
];

/** A motion token: its name in Tailwind (`duration-<name>`, `ease-<name>`) and in CSS. */
export type MotionToken = {
  /** The CSS custom property a script reads. */
  cssVariable: string;
  name: string;
  /** What it becomes with reduced motion. */
  reduced: string;
  use: string;
  utility: string;
};

export const MOTION_DURATIONS: readonly MotionToken[] = [
  {
    cssVariable: "--transition-duration-quick",
    name: "Quick",
    reduced: "Kept: a fade or a color change isn't movement.",
    use: "A state change, a color, a press; an overlay closing. Every Tailwind transition's default.",
    utility: "duration-quick",
  },
  {
    cssVariable: "--transition-duration-base",
    name: "Base",
    reduced: "Kept as a fade; the slide and the zoom drop.",
    use: "An overlay opening, a disclosure, the lesson's screen turn.",
    utility: "duration-base",
  },
  {
    cssVariable: "--transition-duration-pop",
    name: "Pop",
    reduced: "0: no swell.",
    use: "Something already there swells once (`animate-pop`), such as Energy's bolt.",
    utility: "duration-pop",
  },
  {
    cssVariable: "--transition-duration-settle",
    name: "Settle",
    reduced: "0: in place from the first frame.",
    use: "Something earned lands on the spring (`animate-settle`).",
    utility: "duration-settle",
  },
  {
    cssVariable: "--transition-duration-fill",
    name: "Fill",
    reduced: "0: the meter full and the number final from the first frame.",
    use: "A meter filling (`animate-fill`) and a number counting up (`CountUp`) to what was reached, together.",
    utility: "duration-fill",
  },
  {
    cssVariable: "--transition-duration-burst",
    name: "Burst",
    reduced: "0: no sparks.",
    use: "A burst's sparks (`Burst`), out and gone.",
    utility: "duration-burst",
  },
];

export const MOTION_EASINGS: readonly MotionToken[] = [
  {
    cssVariable: "--ease-out",
    name: "Ease-out",
    reduced: "Unchanged.",
    use: "Everything that enters, responds, fills or counts: fast out of the gate, a gentle landing. Every Tailwind transition's default.",
    utility: "ease-out",
  },
  {
    cssVariable: "--ease-spring",
    name: "Spring",
    reduced: "Its animations are gone.",
    use: "Apple's bouncy spring (`Spring(duration: 0.5, bounce: 0.3)`), for something earned landing. Never data, color or opacity.",
    utility: "ease-spring",
  },
];

/** One kind of motion: what it says, how it's made, and its reduced-motion version. */
export type MotionPattern = {
  /** What the learner understands from it. */
  communicates: string;
  /** The tokens and pieces that make it. */
  how: string;
  id: string;
  reduced: string;
  tier: MotionTier["id"];
  title: string;
  /** Where it goes. */
  where: string;
};

export const MOTION_PATTERNS: readonly MotionPattern[] = [
  {
    communicates: "My press landed.",
    how: "`press`: it gives way to `--press-scale` (0.97; a wide option sets 0.99) while held and its colors change, in the quick time. `Button` already presses.",
    id: "press",
    reduced: "No give; the colors still change.",
    tier: "feedback",
    title: "Press",
    where: "Buttons, answer options, choice rows.",
  },
  {
    communicates: "What my action changed, and where.",
    how: "`transition-colors` (or the one property that changes), in the quick time on the ease-out, Tailwind's defaults.",
    id: "state",
    reduced: "Kept: a color change isn't movement.",
    tier: "feedback",
    title: "State change",
    where: "A pick's tint, a check turning blue, a task's segment filling, a toggle.",
  },
  {
    communicates: "How much I reached, adding up.",
    how: "`CountUp`, in the fill's time on the ease-out, beside its meter filling; the value is on the page from the first frame, so nothing reflows.",
    id: "count",
    reduced: "The final number from the first frame.",
    tier: "celebration",
    title: "A number counting up",
    where:
      "Brain Power at a task's end (its readout or tile), the missions' bonus, the summary's total.",
  },
  {
    communicates: "Something new is mine.",
    how: "`animate-settle`: it grows in from `--settle-from` (0.5) and lands on the spring.",
    id: "settle",
    reduced: "In place from the first frame.",
    tier: "celebration",
    title: "Something earned lands",
    where: "A new level's badge, a mission's check, a call's star. Never a character.",
  },
  {
    communicates: "How far it moved, from where it was.",
    how: "`animate-fill` with `origin-left` and `--fill-from` (where it was, as a share of its own length), in step with its number. Never past its value.",
    id: "fill",
    reduced: "Full from the first frame.",
    tier: "celebration",
    title: "A meter filling",
    where:
      "A belt's new tick, the missions' track: only where the moment knows where it was, never from a guessed start.",
  },
  {
    communicates: "This one is rare.",
    how: "`Burst`: eight sparks out of one point and gone, in the moment's own color, on its last beat.",
    id: "burst",
    reduced: "None.",
    tier: "celebration",
    title: "A burst, for the rarest moments",
    where:
      "Today's missions all done, a new belt, the buddy's next stage. Never two in one moment.",
  },
];

/** A celebration, how often it comes, and how much it moves: louder as it's rarer. */
export type CelebrationStep = { how: string; moment: string; often: string };

export const CELEBRATION_LADDER: readonly CelebrationStep[] = [
  {
    how: "Its Brain Power counts up (its readout or tile); the score and the rest hold still. The day's moment under it follows, beat by beat.",
    moment: "A task's end: a lesson, a block, a practice, a drill, a call, a test",
    often: "Several a day",
  },
  {
    how: "Its check lands; its part of the missions' track fills.",
    moment: "A mission done",
    often: "Up to three a day",
  },
  {
    how: "The day's Brain Power counts up under the buddy, who cheers, still; what was celebrated where it was earned (the bonus, a belt's new levels) holds still. Once per day's result: opened again, it's still.",
    moment: "The session's summary",
    often: "Once a day",
  },
  {
    how: "The level's badge lands and its tick fills; Energy's bolt pops once, its meter where Energy is.",
    moment: "A level or a tenth of Energy reached",
    often: "A few a week",
  },
  {
    how: "The Trickster shows his beaten pose, still; the day's missions and level as above.",
    moment: "A challenge won",
    often: "A few a month",
  },
  {
    how: "+50 lands and counts up beside the whole buddy, cheering, still, then one burst from it.",
    moment: "Today's missions all done",
    often: "Once a day at most",
  },
  {
    how: "The buddy stands on its stage in its new look, cheering, still, as one burst flies from behind it (new glasses get none: violet is Brain Power's).",
    moment: "A milestone's ceremony: a new belt, the buddy's next stage, new glasses",
    often: "Weeks apart",
  },
];

export const CHOREOGRAPHY_RULES: readonly string[] = [
  "One thing moves at a time, in the order the learner reads: the number with its meter, then what it earned lands; a burst goes with the last beat.",
  "Each beat starts as the one before lands, about 250ms apart; things of one kind follow each other 100ms apart, three at most.",
  "The last beat starts by 750ms, and everything is still within 1.5s of the screen showing.",
  "Nothing waits for an animation: Continue works from the first frame, and leaving mid-moment just leaves.",
];

/**
 * The buddy and the Trickster are characters, not objects: a person shows a feeling with their face
 * and body, so moving the whole drawing (a hop, a pop, a landing, a tip) reads as a sticker, worse
 * than holding still.
 */
export const CHARACTER_RULES: readonly string[] = [
  "A character never moves as a single unit: no hop, pop, landing, tip, slide or fade of the whole buddy or the whole Trickster, its face in the navigation included.",
  "Until a character has its own rig and acting (its eyes, mouth and limbs moving as parts), it holds still, drawn from the first frame in the expression the moment calls for: the buddy cheering at today's missions, the Trickster leaning back, beaten.",
  "What moves around it keeps moving: the number counting up, the check and the badge landing, the meter filling, the burst.",
  "Reduced motion changes nothing here: the expression is the message, there from the first frame.",
];

export const NEVER_RULES: readonly string[] = [
  "Move a character as one block (a hop, a pop, a landing, a tip): until it can act, it holds still.",
  "Animate navigation or page loads: no route transitions, nothing fading or sliding in.",
  "Animate list rows or grids in, or stagger them.",
  "Loop anything on an everyday screen, except a wait while it waits.",
  "Let data overshoot: a meter or a number stops at its value, and color and opacity never bounce.",
  "Animate layout (`width`, `height`, `top`, `margin`) or write `transition-all`: `scale`, `translate` and opacity only.",
  "Blur, shadows or filters in motion.",
];

export const PERFORMANCE_RULES: readonly string[] = [
  "The compositor runs `scale`, `translate` and opacity on its own thread, so a busy page or a slow phone doesn't stutter them.",
  "A dozen moving things at most, a burst's sparks included.",
  "CSS first; a script reads the tokens (`readDuration`, `readEasing`) and writes outside React's render, as `CountUp` changes one attribute a frame.",
  "Reduced motion lives in the tokens: a celebration's durations and animations are 0 and none under `prefers-reduced-motion: reduce`, so anything built on them is calm with no extra code.",
];

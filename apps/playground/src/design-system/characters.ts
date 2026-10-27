import { type BuddyExpression } from "@zoonk/ui/components/buddy";
import { type TricksterExpression } from "@zoonk/ui/components/trickster";

/**
 * How the buddy and the Trickster act: the rules, their parts, expressions and acts, when each
 * plays, idle and timing. The rig and the acts live in `@zoonk/ui` (`BuddyActor`,
 * `TricksterActor`), their tokens in `packages/ui/src/styles/globals.css` (`duration-frame`,
 * `ease-accelerate`, `ease-swing`, `ease-follow`), and the playground's `/design/characters` page
 * plays every act beside these words. How to apply them: the `zoonk-motion` skill.
 */

/**
 * The buddy and the Trickster are characters, not objects: a person shows a feeling with their face
 * and body, so moving the whole drawing (a hop, a pop, a landing, a tip) reads as a sticker, worse
 * than holding still. They act with their parts instead, as `/design/characters` shows.
 */
export const CHARACTER_RULES: readonly string[] = [
  "A character never moves as a single unit: no hop, pop, landing, tip, slide or fade of the whole buddy or the whole Trickster, its face in the navigation included. Inside an act its body may squash, stretch or lean on its feet, while its face and loose parts do their own thing.",
  "It acts with its parts, eyes first: the eyes lead (a blink, a glance), the brows and mouth follow, then the head and the arms, and the loose parts (antennae, a tail, a crown) last, swinging past their stop.",
  "An expression swaps the whole face, as a 2D animator replaces a drawing, while the eyes are shut or a part is squashed, so the change reads as one motion. The arms never mirror each other: one starts a frame later and goes less far.",
  "Acts play only in the lab until the owner approves one for a moment. In the product a character holds still, drawn from the first frame in the expression the moment calls for: the buddy cheering at today's missions, the Trickster leaning back, beaten.",
  "What moves around it keeps moving: the number counting up, the check and the badge landing, the meter filling, the burst.",
  "With reduced motion an act draws its expression at once (the face, and the Trickster's pose), and nothing moves.",
];

/** A character's named part (`data-part`) and how acts move it. */
export type CharacterPart = { moves: string; parts: string };

export const CHARACTER_PARTS: readonly CharacterPart[] = [
  {
    moves:
      "Shut to a sliver for a blink or a squint, or widen; `lid-left` and `lid-right` are the line a shut eye shows.",
    parts: "`eye-left`, `eye-right`",
  },
  { moves: "Dart for a glance in two frames, then hold.", parts: "`pupil-left`, `pupil-right`" },
  { moves: "Rise and tilt: surprise, pride, worry.", parts: "`brow-left`, `brow-right`" },
  { moves: "Stretches and squashes around a swap.", parts: "`mouth`" },
  {
    moves: "Slides inside the head, so a glance or a lifted chin reads as the head turning.",
    parts: "`face`",
  },
  { moves: "Tilts around the neck, after the eyes.", parts: "`head`" },
  {
    moves:
      "Squashes and stretches around the feet, which stay put with the shadow; the Trickster leans.",
    parts: "`body`",
  },
  {
    moves: "Swing from the shoulder (Otto's arms are his outer tentacles).",
    parts: "`arm-left`, `arm-right`",
  },
  {
    moves: "Loose parts: they lag behind what drives them and follow through on `ease-follow`.",
    parts: "`antenna-left`, `antenna-right`, `antenna`; the Trickster's `tail`, `crown`",
  },
];

/** Which characters wear a light, and how Energy reads on the ones that don't. */
export const CHARACTER_LIGHT_RULES: readonly string[] = [
  "Only Zu's antenna tips and Beep's antenna bulb light up, in orange, brighter and wider as Energy rises, and dark while the buddy naps.",
  "Noodle, Otto and the Trickster wear no light: a bright spot on them pulled the eye away from the screen. Otto's spots are its skin, a shade deeper than it.",
  "Every buddy's Energy shows in its face, the same for all four: sleepy while it naps (under 30% on a day without study), happy when awake, beaming from 80%. The number is where Energy is shown: the buddy's tab and a result's Energy row.",
];

/** An expression as the server draws it, still: what it says and where it belongs. */
export type CharacterExpression<Name extends string> = { label: string; name: Name; says: string };

export const BUDDY_EXPRESSIONS: readonly CharacterExpression<BuddyExpression>[] = [
  { label: "Neutral", name: "neutral", says: "Calm, listening." },
  { label: "Happy", name: "happy", says: "Its everyday face, awake." },
  { label: "Cheering", name: "cheer", says: "Joy: today's missions, a belt." },
  { label: "Proud", name: "proud", says: "Pleased with you: a level, a challenge won." },
  { label: "Surprised", name: "wow", says: "A reveal." },
  { label: "Thinking", name: "think", says: "Working something out, while a reply waits." },
  { label: "Kind", name: "kind", says: "Gentle, after a mistake." },
  { label: "Sleepy", name: "sleepy", says: "Low Energy and no study today." },
];

export const TRICKSTER_EXPRESSIONS: readonly CharacterExpression<TricksterExpression>[] = [
  { label: "Sly", name: "sly", says: "Running a challenge." },
  { label: "Smug", name: "smug", says: "He just scored." },
  {
    label: "Defeated",
    name: "defeated",
    says: "Beaten: slumped, crown slipping, tail wilting, a drop of sweat.",
  },
];

/** An act: what happens, in what order, and the moment it's proposed for. */
export type CharacterAct = { character: string; does: string; name: string; when: string };

export const CHARACTER_ACTS: readonly CharacterAct[] = [
  {
    character: "Buddy",
    does: "The lids close in 2 frames, stay shut for 1 and open in 3, all the way, as people blink.",
    name: "Blink",
    when: "About 2s after an act settles, and with a change of thought or gaze. Never on a timer on an everyday screen.",
  },
  {
    character: "Buddy",
    does: "The pupils dart in 2 frames; the face slides and the head turns after them, the antennae lag, and a blink comes with the return.",
    name: "Glance",
    when: "Toward what changed: a message sent in the buddy's chat, an answer picked beside it.",
  },
  {
    character: "Buddy",
    does: "Neutral to happy: a squint first, the mouth stretches into the smile, the head tips and the body lifts.",
    name: "Smile",
    when: "A right answer or a kind word in the buddy's chat, a mission done beside its face.",
  },
  {
    character: "Buddy",
    does: "Anticipation (a dip, eyes squeezed shut), then the grin as the body stretches and the arms swing out a frame apart; the antennae drag behind and wobble last.",
    name: "Cheer",
    when: "Today's missions all done, the session's summary, a milestone's ceremony: where the hop was.",
  },
  {
    character: "Buddy",
    does: "A take: a quick dip, the eyes pop wide and the mouth opens, the body stretches, the arms lift, and a blink as it sinks in.",
    name: "Surprise",
    when: "A reveal, such as a ceremony opening, before the cheer.",
  },
  {
    character: "Buddy",
    does: "The eyes close into a content arc, the chin lifts as the head tips back and the face slides up, the chest fills, the brows rise last.",
    name: "Proud",
    when: "A level reached; a challenge won, beside the beaten Trickster.",
  },
  {
    character: "Trickster",
    does: "A squint lowers his lids, the far brow climbs, the grin widens, a two-beat chuckle runs through his body and arms, the crown cocks and the tail swishes.",
    name: "Smug",
    when: "A duel's intro, and when the learner misses one.",
  },
  {
    character: "Trickster",
    does: "A take (eyes wide, brows high, the crown hopping), a held beat, eyes shut through the swap, then the slump: the arms drop a frame apart, the tail wilts, the crown slides over his brow last, a sigh, a drop of sweat.",
    name: "Defeated",
    when: "A challenge won: where he tipped back.",
  },
];

/** When a character may move without an act the learner caused: almost never. */
export const CHARACTER_IDLE_RULES: readonly string[] = [
  "Everyday screens stay still: the buddy in the navigation, on Today and on its tab never idles.",
  "After an act it holds its pose; one blink about 2s later keeps it from looking frozen (a moving hold), then it rests, all within 5s (WCAG 2.2.2).",
  "Where a character is the screen's subject and the learner is engaged with it (the buddy's chat, a duel), it reacts to what happens (a glance at what changed, a blink with a change of thought), never on a timer.",
  "While it waits for a reply, a slow blink may repeat, as a wait may loop; it stops when the wait does.",
];

/** How acts are timed, in frames at 24 a second. */
export const CHARACTER_TIMING_RULES: readonly string[] = [
  'Acts are timed in frames (`duration-frame`, 24 a second); a script reads it with `readDuration(element, "frame")`, and reduced motion makes it 0.',
  "A blink: 2 frames down on `ease-accelerate`, 1 shut, 3 up on the ease-out. A dart: 2 frames on the ease-out, most of the travel in the first.",
  "Anticipation takes 3 to 4 frames on `ease-accelerate`, the action 3 to 5 on the ease-out, the settle 6 to 12 on `ease-spring` (the body) or `ease-follow` (loose parts); a weight shift or a head turn swings (`ease-swing`).",
  "Loose parts start 1 to 2 frames after what drives them, and the arms never start or stop on the same frame.",
  "An act lasts 6 to 42 frames, under 2s, and never blocks: Continue works from its first frame.",
];

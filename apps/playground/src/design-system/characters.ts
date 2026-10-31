import { type BuddyExpression } from "@zoonk/ui/components/buddy";
import { type BuddyActName } from "@zoonk/ui/components/buddy-actor";
import { type TricksterExpression } from "@zoonk/ui/components/trickster";
import { type TricksterActName } from "@zoonk/ui/components/trickster-actor";

/**
 * The rig and acts live in `@zoonk/ui` (`BuddyActor`, `TricksterActor`), their tokens in
 * `packages/ui/src/styles/globals.css`, and `/design/characters` plays every act. How to apply them:
 * the `zoonk-motion` skill.
 */

export const CHARACTER_RULES: readonly string[] = [
  "A character never moves as a single unit: no hop, pop, landing, tip, slide or fade of the whole buddy or the whole Trickster, its face in the navigation included. Inside an act its body may squash, stretch or lean on its feet, as long as it reads natural, while its face and loose parts do their own thing.",
  "It acts with its parts, eyes first: the eyes lead (a blink, a glance), the brows and mouth follow, then the head and the arms, and the loose parts (antennae, a tail, a crown) last, swinging past their stop.",
  "An expression swaps the whole face, as a 2D animator replaces a drawing, while the eyes are shut or a part is squashed, so the change reads as one motion. The arms never mirror each other: one starts a frame later and goes less far.",
  "It reacts where it appears because something happened (the learner's work earned something, a challenge was decided, its answer came in): its act plays once, on the moment's beat (`reaction`, as `useCelebration` says). In the big celebrations its whole body reacts. A reload, a revisit or the way back draws the act's landing still, so the server draws the final pose and nothing flashes.",
  "It holds still where it only illustrates a screen or is small: the sidebar and the tab bar, Today and its missions card, list rows and marks, pickers, empty states.",
  "It's never in the way: Continue works from an act's first frame, and a press, ⏎ or Esc lands an act under way at once.",
  "What moves around it keeps moving: the number counting up, the check and the badge landing, the meter filling, the burst.",
  "With reduced motion an act draws its expression at once (the face, and the Trickster's pose), and nothing moves.",
];

export type CharacterMoment = { act: string; beat: string; character: string; moment: string };

export const CHARACTER_MOMENTS: readonly CharacterMoment[] = [
  {
    act: "Smile",
    beat: "As the mission's check stamps in, a beat in",
    character: "The buddy's face",
    moment:
      "A mission done, at the end of the work that did it (a lesson, a block, a practice, a drill, a round, a call, a test, a mock, a duel)",
  },
  {
    act: "Cheer",
    beat: "As the bonus lands, two beats in, stretching up as the burst flies",
    character: "The whole buddy",
    moment: "Today's missions all done",
  },
  {
    act: "Proud",
    beat: "A beat after the day's Brain Power starts counting up",
    character: "The buddy",
    moment: "The session's summary",
  },
  {
    act: "Cheer",
    beat: "A beat in, as the burst flies from behind it",
    character: "The buddy, large on its stage",
    moment: "A new belt, the buddy's next stage",
  },
  {
    act: "Proud",
    beat: "A beat in: it shows them off",
    character: "The buddy, large on its stage",
    moment: "New glasses",
  },
  {
    act: "Glance, then Smile",
    beat: "As the learner sends a message; as its answer comes in",
    character: "The buddy's face on its tab, while it's awake",
    moment: "The buddy's chat",
  },
  {
    act: "Smug",
    beat: "A beat in",
    character: "The Trickster, holding his sign",
    moment: "A challenge's intro",
  },
  {
    act: "Smug, or Back to sly",
    beat: "As each verdict comes in",
    character: "The Trickster beside the question, on wide screens",
    moment: "A duel: a miss, or one the learner got past him",
  },
  { act: "Defeated", beat: "A beat in", character: "The Trickster", moment: "A challenge won" },
  {
    act: "Smug",
    beat: "A beat in",
    character: "The Trickster, holding his sign",
    moment: "A challenge lost",
  },
];

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
    moves:
      "Swing from the shoulder (Otto's arms are his outer tentacles); the Trickster's `sign` turns with the arm holding it.",
    parts: "`arm-left`, `arm-right`, `sign`",
  },
  {
    moves: "Loose parts: they lag behind what drives them and follow through on `ease-follow`.",
    parts: "`antenna-left`, `antenna-right`, `antenna`; the Trickster's `tail`, `crown`",
  },
];

export const CHARACTER_LIGHT_RULES: readonly string[] = [
  "Only Zu's antenna tips and Beep's antenna bulb light up, in orange, brighter and wider as Energy rises, and dark while the buddy naps.",
  "Noodle, Otto and the Trickster wear no light: a bright spot on them pulled the eye away from the screen. Otto's spots are its skin, a shade deeper than it.",
  "Every buddy's Energy shows in its face, the same for all four: sleepy while it naps (under 30% on a day without study), happy when awake, beaming from 80%. The number is where Energy is shown: the buddy's tab and a result's Energy row.",
];

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

export type CharacterAct = { does: string; name: string; when: string } & (
  | { act: BuddyActName; character: "buddy" }
  | { act: TricksterActName; character: "trickster" }
);

export const CHARACTER_ACTS: readonly CharacterAct[] = [
  {
    act: "blink",
    character: "buddy",
    does: "The lids close in 2 frames, stay shut for 1 and open in 3, all the way, as people blink.",
    name: "Blink",
    when: "About 2s after a reaction lands in a face with open eyes, and inside other acts with a change of gaze. Never on a timer.",
  },
  {
    act: "glance",
    character: "buddy",
    does: "The pupils dart in 2 frames; the face slides and the head turns after them, the antennae lag, and a blink comes with the return.",
    name: "Glance",
    when: "The buddy's chat: at the message the learner sends.",
  },
  {
    act: "smile",
    character: "buddy",
    does: "Neutral to happy: a squint first, the mouth stretches into the smile, the head tips and the body lifts.",
    name: "Smile",
    when: "A mission done, beside its face; the buddy's chat, as its answer comes in.",
  },
  {
    act: "cheer",
    character: "buddy",
    does: "Anticipation (a dip, eyes squeezed shut), then the grin as the body stretches and the arms swing out a frame apart; the antennae drag behind and wobble last.",
    name: "Cheer",
    when: "Today's missions all done; a new belt or the buddy's next stage.",
  },
  {
    act: "surprise",
    character: "buddy",
    does: "A take: a quick dip, the eyes pop wide and the mouth opens, the body stretches, the arms lift, and a blink as it sinks in.",
    name: "Surprise",
    when: "No moment yet: kept for a reveal.",
  },
  {
    act: "proud",
    character: "buddy",
    does: "The eyes close into a content arc, the chin lifts as the head tips back and the face slides up, the chest fills, the brows rise last.",
    name: "Proud",
    when: "The session's summary; new glasses.",
  },
  {
    act: "blink",
    character: "trickster",
    does: "Under his mask the eyes squash to a sliver in 2 frames, stay shut for 1 and open in 3.",
    name: "Blink",
    when: "About 2s after a reaction lands.",
  },
  {
    act: "smug",
    character: "trickster",
    does: "A squint lowers his lids, the far brow climbs, the grin widens, a two-beat chuckle runs through his body and arms, the crown cocks and the tail swishes.",
    name: "Smug",
    when: "A challenge's intro, a duel's miss, a challenge lost.",
  },
  {
    act: "sly",
    character: "trickster",
    does: "A blink, his face swapping while his eyes are shut (the grin drops, the lids lift), the crown and the tail easing back after it. From sly it's only a blink.",
    name: "Back to sly",
    when: "A duel's answer that got past him.",
  },
  {
    act: "defeat",
    character: "trickster",
    does: "A take (eyes wide, brows high, the crown hopping), a held beat, eyes shut through the swap, then the slump: the arms drop a frame apart, the tail wilts, the crown slides over his brow last, a sigh, a drop of sweat.",
    name: "Defeated",
    when: "A challenge won.",
  },
];

export const CHARACTER_IDLE_RULES: readonly string[] = [
  "Everyday screens stay still: the buddy in the navigation, on Today and on its tab never idles.",
  "After a reaction it holds its pose; where its eyes are open, one blink about 2s later keeps it from looking frozen (a moving hold), then it rests, all within 5s (WCAG 2.2.2). A face with its eyes shut (cheering, proud, asleep) just holds.",
  "Where a character is the screen's subject and the learner works with it (the buddy's chat, a duel), it reacts to what happens (a glance at a message, a smile at its answer, a smirk at a miss), never on a timer.",
];

export const CHARACTER_TIMING_RULES: readonly string[] = [
  'Acts are timed in frames (`duration-frame`, 24 a second); a script reads it with `readDuration(element, "frame")`, and reduced motion makes it 0.',
  "A blink: 2 frames down on `ease-accelerate`, 1 shut, 3 up on the ease-out. A dart: 2 frames on the ease-out, most of the travel in the first.",
  "Anticipation takes 3 to 4 frames on `ease-accelerate`, the action 3 to 5 on the ease-out, the settle 6 to 12 on `ease-spring` (the body) or `ease-follow` (loose parts); a weight shift or a head turn swings (`ease-swing`).",
  "Loose parts start 1 to 2 frames after what drives them, and the arms never start or stop on the same frame.",
  "An act lasts 6 to 42 frames, under 2s, starts on its moment's beat (`delay`, on the animation clock, so a slowed page slows it too) and never blocks: Continue works from its first frame, and a press, ⏎ or Esc lands it at once.",
];

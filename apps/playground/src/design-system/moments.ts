/** The system in a few lines, and the few moments allowed to be louder than the rest. */

/** A moment allowed to be louder than the rest: earned, rare and brief. */
export type Moment = { id: string; summary: string; title: string; where: string };

export const MOMENTS: readonly Moment[] = [
  {
    id: "missions",
    summary:
      "Every mission done: the reward lights up as a solid violet chip and the buddy's ring closes in violet.",
    title: "Today's missions complete",
    where:
      "`BrainPowerReward` earned, `MissionsRing` complete, the missions card folding to one line.",
  },
  {
    id: "mission",
    summary: "A mission done since the learner last looked: its arc fills and the face pops once.",
    title: "A mission done",
    where: "`MissionsRing`'s moment, `MissionMoment`, `SparkBurst`.",
  },
  {
    id: "reward",
    summary: "A lesson's or a session's end: the Brain Power earned as a violet readout.",
    title: "Brain Power earned",
    where: "The completion and the session summary's rewards.",
  },
];

export const MOMENT_RULES: readonly string[] = [
  "Louder means a solid fill and a short motion, never a new color: violet is still only Brain Power.",
  "Each fires once, when it's earned; never on load, never as decoration.",
  "Every motion has a calm reduced-motion version.",
];

/** The system in a few lines, for the overview. */
export const PRINCIPLES: readonly string[] = [
  "Neutral by default, colored on purpose: tone steps separate, color signals.",
  "Soft colors in the regular theme; strict contrast when the device asks for more.",
  "One meaning per hue, the same on every screen, and never color alone.",
  "The text color is the action and the learner's own; blue is progress made.",
  "Titles, not labels; readouts with meters; fewer boxes.",
  "Modern and quiet like Linear and Vercel: nothing crowded, nothing flashy, except a few earned moments.",
];

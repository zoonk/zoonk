/** The system in a few lines, and the few moments allowed to be louder than the rest. */

/** A moment allowed to be louder than the rest: earned, rare and brief. */
export type Moment = { id: string; summary: string; title: string; where: string };

export const MOMENTS: readonly Moment[] = [
  {
    id: "task-end",
    summary:
      "The end of a lesson, a session's block, a drill or a call: its title says what happened, then what it earned as readouts (the score in the text color, Brain Power in violet), the facts on one mono line, and what's next. While it saves, the title is already in place.",
    title: "A task's end",
    where:
      "`MomentReadouts` (with `BrainPowerReadout`), `StudyMoment`, the lesson's `LessonCompletionMoment`, and `PendingMoment` while it saves.",
  },
  {
    id: "mission",
    summary:
      "The work that completed a mission: the buddy's face beside \"Mission done!\" and what's left for the day's bonus, the violet track filling, and the mission's check stamping in (\"Just done\").",
    title: "A mission done",
    where: "`MissionMoment` on its violet-tinted panel, `MissionTrack`, `MissionsRing`'s moment.",
  },
  {
    id: "missions",
    summary:
      "The day's last mission: the whole buddy, \"Today's missions done!\" and the bonus as Brain Power's violet readout. On Today the reward lights up as a solid violet chip and the buddy's ring closes in violet.",
    title: "Today's missions done",
    where:
      "`MissionMoment` with the bonus paid, `BrainPowerReward` earned, `MissionsRing` complete.",
  },
  {
    id: "reached",
    summary:
      "What a block took the learner to, as rows under its missions: \"Level up!\" with the new level on its belt's color and the belt's ten levels as a meter in that color; Energy's next tenth with its bolt and an amber meter, and what it means for the buddy.",
    title: "A level or Energy reached",
    where: "`ReachedMoment`, `BeltTicks`, `Meter`.",
  },
  {
    id: "ceremony",
    summary:
      "A new belt, the buddy's next stage or new glasses: the loudest moment, full screen and before the block's moment. The buddy big, wearing what changed, a title, one line and one action (new glasses add \"Not now\"). A badge has no ceremony; the challenge's result shows it.",
    title: "A milestone's ceremony",
    where: "`MilestoneCeremony`, put first by `MomentAfterCeremony`.",
  },
  {
    id: "challenge",
    summary:
      "The Trickster beaten or not, the title, the score as a readout, then the day's moment (missions, a level or Energy reached) and what the duel earned as rows, with what comes next.",
    title: "A challenge's end",
    where: "`CheckpointResultView` (`MomentReadouts`, `MissionMoment`, `ReachedMoment`).",
  },
  {
    id: "summary",
    summary:
      "The session's end: the day's numbers as tiles and the skills that rose, then what it earned: the buddy glad, Brain Power as its violet readout, and the bonus, a belt's new stripes and the best streak as rows.",
    title: "The session's end",
    where: "`SessionSummary`, `RewardsStep` and `EarnedToday` (`BrainPowerReadout`, `BeltTicks`).",
  },
];

/**
 * How every celebration is built, so they read as one family. Motion is its own guideline; these
 * say what moves, never how.
 */
export const MOMENT_RULES: readonly string[] = [
  "One family, one order: a celebration sits where a task's result sits (top of the column, under the header) and reads the title, what was earned as readouts, the day's moment (missions, then a level or Energy reached), then what's next. Its one action is pinned in the bar and Enter presses it.",
  "Warmer than everyday screens, never busy: the buddy or the Trickster where it's the subject, a big readout for what was earned, and nothing to read twice.",
  "Color only by meaning: violet for Brain Power and missions, a belt in its own colors, Energy amber, done blue. Louder means a solid fill or a tint whose color is the reward (the lit chip, the missions panel) and a short motion, never a new color.",
  "Each fires once, when it's earned: never on load, never as decoration, and never in the way of the next step.",
  "Every motion has a calm reduced-motion version. Each part that may move is its own element with a `data-slot`: `readout-number`, `missions-bonus`, `moment-buddy`, `mission-stamp`, `mission-track`, `level-badge`, `belt-ticks`, `energy-mark`.",
];

/** The system in a few lines, for the overview. */
export const PRINCIPLES: readonly string[] = [
  "Neutral by default, colored on purpose: tone steps separate, color signals.",
  "Soft colors in the regular theme; strict contrast when the device asks for more.",
  "One meaning per hue, the same on every screen, and never color alone.",
  "The text color is the action and the learner's pick; blue is progress made, up to where the learner is.",
  "Titles, not labels; readouts with meters; fewer boxes.",
  "Modern and quiet like Linear and Vercel: nothing crowded, nothing flashy, except a few earned moments.",
];

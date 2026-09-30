import {
  type ActivityRendererMap,
  defineActivityRenderer,
} from "./_utils/define-activity-renderer";

/** Music: keyboard and fretboard, notation, ear training and rhythm. Spread into `activityRenderers`. */
export const musicRenderers: ActivityRendererMap<
  "earTrainer" | "keyboardFretboard" | "notationPlayer" | "rhythmTapper"
> = {
  earTrainer: defineActivityRenderer({
    badge: "earTraining",
    load: () =>
      import("./ear-trainer/ear-trainer-activity").then((module) => module.EarTrainerActivity),
    template: "earTrainer",
  }),
  keyboardFretboard: defineActivityRenderer({
    badge: "playIt",
    load: () =>
      import("./keyboard-fretboard/keyboard-fretboard-activity").then(
        (module) => module.KeyboardFretboardActivity,
      ),
    template: "keyboardFretboard",
  }),
  notationPlayer: defineActivityRenderer({
    badge: "readAndListen",
    load: () =>
      import("./notation-player/notation-player-activity").then(
        (module) => module.NotationPlayerActivity,
      ),
    template: "notationPlayer",
  }),
  rhythmTapper: defineActivityRenderer({
    badge: "tapAlong",
    load: () =>
      import("./rhythm-tapper/rhythm-tapper-activity").then(
        (module) => module.RhythmTapperActivity,
      ),
    template: "rhythmTapper",
  }),
};

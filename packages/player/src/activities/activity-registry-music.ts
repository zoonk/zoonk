import {
  type ActivityRendererMap,
  defineActivityRenderer,
} from "./_utils/define-activity-renderer";

export const musicRenderers: ActivityRendererMap<
  "keyboardFretboard" | "notationPlayer" | "rhythmTapper"
> = {
  keyboardFretboard: defineActivityRenderer({
    badge: ({ fields }) => (fields.byEar ? "earTraining" : "playIt"),
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

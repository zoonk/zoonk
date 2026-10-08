import {
  type ActivityRendererMap,
  defineActivityRenderer,
} from "./_utils/define-activity-renderer";

/** Languages: sentence builder, pattern table, dialogue and listening at any speed. Spread into `activityRenderers`. */
export const languageRenderers: ActivityRendererMap<
  "dialogueSimulator" | "listeningSpeed" | "patternTable" | "sentenceBuilder"
> = {
  dialogueSimulator: defineActivityRenderer({
    badge: "reply",
    load: () =>
      import("./dialogue-simulator/dialogue-simulator-activity").then(
        (module) => module.DialogueSimulatorActivity,
      ),
    template: "dialogueSimulator",
  }),
  listeningSpeed: defineActivityRenderer({
    badge: "listen",
    load: () =>
      import("./listening-speed/listening-speed-activity").then(
        (module) => module.ListeningSpeedActivity,
      ),
    template: "listeningSpeed",
  }),
  patternTable: defineActivityRenderer({
    badge: "spotPattern",
    load: () =>
      import("./pattern-table/pattern-table-activity").then(
        (module) => module.PatternTableActivity,
      ),
    template: "patternTable",
  }),
  sentenceBuilder: defineActivityRenderer({
    badge: "buildSentence",
    load: () =>
      import("./sentence-builder/sentence-builder-activity").then(
        (module) => module.SentenceBuilderActivity,
      ),
    template: "sentenceBuilder",
  }),
};

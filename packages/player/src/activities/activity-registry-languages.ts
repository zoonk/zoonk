import {
  type ActivityRendererMap,
  defineActivityRenderer,
} from "./_utils/define-activity-renderer";

export const languageRenderers: ActivityRendererMap<"dialogueSimulator" | "patternTable"> = {
  dialogueSimulator: defineActivityRenderer({
    badge: "reply",
    load: () =>
      import("./dialogue-simulator/dialogue-simulator-activity").then(
        (module) => module.DialogueSimulatorActivity,
      ),
    template: "dialogueSimulator",
  }),
  patternTable: defineActivityRenderer({
    badge: "spotPattern",
    load: () =>
      import("./pattern-table/pattern-table-activity").then(
        (module) => module.PatternTableActivity,
      ),
    template: "patternTable",
  }),
};

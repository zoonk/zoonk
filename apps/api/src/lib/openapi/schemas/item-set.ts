import { listeningSetViewSchema } from "@zoonk/core/library/listening/view";

/** Who said what in a recording, in order, by the names it gives. */
export const listeningTranscriptSchema = listeningSetViewSchema.shape.transcript;

/**
 * The stimulus a question shares with its set's other questions (a passage, a case, a chart or a
 * recording), shown with each of them; never an answer.
 */
export { itemSetViewSchema as itemSetSchema } from "@zoonk/core/library/items/set-view";

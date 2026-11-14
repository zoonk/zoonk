/**
 * The answers at the foot of what opens over a page, written with the main one last. A row (from
 * `sm`) draws them in that order, ending with the main one. A stack (on a phone, or three answers,
 * which a sheet's width can't hold in a row) draws the main one on top: the one place a drawn order
 * isn't the reading order, kept because a stack read from its other answer to its main one loses no
 * meaning, while the main answer on top is where every phone sheet puts it.
 */
export const OVERLAY_ACTIONS_CLASS =
  "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:has-[>:nth-child(3)]:flex-col-reverse";

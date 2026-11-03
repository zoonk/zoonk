import { type TargetSample, describeTarget, isHiddenTarget, isInText } from "./target-size";

/** A field selects what you type, and a held link previews its page instead of selecting. */
const SELECTING_ROLES = new Set(["a", "combobox", "input", "link", "select", "textarea"]);

export const LABELED_DRAWING_SELECTOR = "svg:has(text)";

/**
 * A finger held on a control selects its words instead of pressing or dragging it, as on iOS. Words
 * in running text stay selectable, so a copied sentence keeps them.
 */
export function findSelectableTargets(samples: TargetSample[]): string[] {
  return samples
    .filter(
      (sample) =>
        sample.userSelect !== "none" &&
        sample.ownTextLength > 0 &&
        !SELECTING_ROLES.has(sample.role) &&
        !isHiddenTarget(sample) &&
        !isInText(sample),
    )
    .map((sample) => describeTarget(sample));
}

/** A drag that starts on a label selects it, even in a drawing hidden from screen readers. */
export function findSelectableDrawings(samples: TargetSample[]): string[] {
  return samples
    .filter(
      (sample) =>
        sample.userSelect !== "none" &&
        sample.visibility === "visible" &&
        sample.width > 1 &&
        sample.height > 1,
    )
    .map((sample) => describeTarget(sample));
}

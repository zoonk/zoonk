import { type Page } from "@playwright/test";

/**
 * Zoonk's rule for anything people tap or click: 44 px each way, counting a hit area drawn by a
 * `::before` or `::after` (the `Button` primitive's). WCAG 2.2's 24 px (2.5.8) is the floor this
 * sits above; axe's own `target-size` rule is off by default and checks only that floor.
 */
export const MIN_TARGET_PX = 44;

const TARGET_LIMITS = {
  /** A word in a sentence can be a little taller than its line (padding, room for focus). */
  lineTolerance: 1.25,
  min: MIN_TARGET_PX,
  /** How much of a target's name a failure quotes. */
  nameLength: 40,
  /** Roughly what browsers use for `line-height: normal`. */
  normalLineHeight: 1.2,
  /** Browsers round layout sizes, so 43.99 px counts as 44. */
  sizeTolerance: 0.5,
};

const TARGET_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  ...[
    "button",
    "checkbox",
    "combobox",
    "link",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "radio",
    "slider",
    "switch",
    "tab",
  ].map((role) => `[role=${role}]`),
].join(",");

/** What the browser measures of one target, judged here in Node. */
type TargetSample = {
  /** Disabled, inert or hidden from assistive tech: nothing to press. */
  inactive: boolean;
  /** Characters of text in the block the target's line sits in, and in the target itself. */
  blockText: number;
  ownText: number;
  /** The block's `line-height` and `font-size`, as computed ("24px", or "normal"). */
  blockLineHeight: string;
  blockFontSize: string;
  clipPath: string;
  display: string;
  /** The height of the target's first line box, which is its whole height unless it wraps. */
  firstLineHeight: number;
  height: number;
  width: number;
  name: string;
  overflow: string;
  pointerEvents: string;
  /** The sizes of an absolutely positioned `::before`/`::after`, as computed ("44px"). */
  pseudos: { height: string; width: string }[];
  role: string;
  slot: string | undefined;
  visibility: string;
};

/** Reads the candidate targets on screen; `page.evaluate` sends this to the browser. */
function sampleTargets(page: Page): Promise<TargetSample[]> {
  return page.evaluate(
    (selector) =>
      [...document.querySelectorAll<HTMLElement>(selector)].map((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        const ancestors = document.evaluate(
          "ancestor::*",
          element,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null,
        );

        // The block the element's line of text sits in: its nearest ancestor that isn't inline.
        const block =
          Array.from({ length: ancestors.snapshotLength }, (_, index) =>
            ancestors.snapshotItem(index),
          )
            .toReversed()
            .find(
              (node): node is HTMLElement =>
                node instanceof HTMLElement && getComputedStyle(node).display !== "inline",
            ) ?? document.body;

        const blockStyle = getComputedStyle(block);

        return {
          blockFontSize: blockStyle.fontSize,
          blockLineHeight: blockStyle.lineHeight,
          blockText: block.textContent.trim().length,
          clipPath: style.clipPath,
          display: style.display,
          firstLineHeight: element.getClientRects()[0]?.height ?? rect.height,
          height: rect.height,
          inactive:
            element.matches(":disabled, [aria-disabled='true']") ||
            Boolean(element.closest("[inert], [aria-hidden='true']")),
          name: element.getAttribute("aria-label") ?? element.textContent.trim(),
          overflow: style.overflow,
          ownText: element.textContent.trim().length,
          pointerEvents: style.pointerEvents,
          pseudos: ["::before", "::after"]
            .map((pseudo) => getComputedStyle(element, pseudo))
            .filter((pseudo) => pseudo.content !== "none" && pseudo.position === "absolute")
            .map((pseudo) => ({ height: pseudo.height, width: pseudo.width })),
          role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
          slot: element.dataset.slot,
          visibility: style.visibility,
          width: rect.width,
        };
      }),
    TARGET_SELECTOR,
  );
}

function toPixels(value: string): number {
  return Number(value.replace("px", "")) || 0;
}

/**
 * Nothing to press: inactive, invisible, or visually hidden (screen-reader-only controls and Base
 * UI's slider input clip themselves to nothing).
 */
function isHiddenTarget(sample: TargetSample): boolean {
  return (
    sample.inactive ||
    sample.visibility !== "visible" ||
    sample.pointerEvents === "none" ||
    sample.clipPath === "inset(50%)" ||
    sample.width <= 1 ||
    sample.height <= 1
  );
}

/**
 * The one exception: a target inside running text (a link in a sentence, or a word or phrase in a
 * passage that opens its meaning or can be picked). It sits in the line (a button in text computes
 * to `inline-block`), has other text around it and is no taller than that line, so WCAG 2.5.8
 * exempts it because its height comes from the text.
 */
function isInText(sample: TargetSample): boolean {
  const lineHeight =
    toPixels(sample.blockLineHeight) ||
    toPixels(sample.blockFontSize) * TARGET_LIMITS.normalLineHeight;

  return (
    (sample.display === "inline" || sample.display === "inline-block") &&
    sample.blockText > sample.ownText &&
    sample.firstLineHeight <= lineHeight * TARGET_LIMITS.lineTolerance
  );
}

/**
 * Where the target can be pressed: its box, widened by a `::before`/`::after` laid over it (the
 * `hit-area` utility) unless it clips its overflow and cuts that back.
 */
function getHitArea(sample: TargetSample) {
  const pseudos = sample.overflow === "visible" ? sample.pseudos : [];

  return {
    height: Math.max(sample.height, ...pseudos.map((pseudo) => toPixels(pseudo.height))),
    width: Math.max(sample.width, ...pseudos.map((pseudo) => toPixels(pseudo.width))),
  };
}

function describeTarget(sample: TargetSample, size: { height: number; width: number }): string {
  const name = sample.name.replaceAll(/\s+/gu, " ").slice(0, TARGET_LIMITS.nameLength);
  const slot = sample.slot ? ` data-slot="${sample.slot}"` : "";
  const measured = `${Math.round(size.width)}×${Math.round(size.height)} px`;

  return `<${sample.role}${slot}> "${name}" is ${measured}`;
}

/**
 * The interactive targets on screen smaller than 44 px either way, described with their size.
 * Only what can be pressed counts, and a target inside running text is exempt (`isInText`); a
 * link or button that stands on its own must be 44 px.
 */
export async function findSmallTargets(page: Page): Promise<string[]> {
  const samples = await sampleTargets(page);
  const smallest = TARGET_LIMITS.min - TARGET_LIMITS.sizeTolerance;

  return samples.flatMap((sample) => {
    if (isHiddenTarget(sample) || isInText(sample)) {
      return [];
    }

    const size = getHitArea(sample);
    return size.height >= smallest && size.width >= smallest ? [] : [describeTarget(sample, size)];
  });
}

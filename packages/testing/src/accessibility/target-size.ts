/** Zoonk's tap target rule sits above WCAG 2.2's 24 px floor (2.5.8), the only one axe checks. */
export const MIN_TARGET_PX = 44;

const TARGET_LIMITS = {
  /** A word in a sentence can be a little taller than its line (padding, room for focus). */
  lineTolerance: 1.25,
  min: MIN_TARGET_PX,
  nameLength: 40,
  /** Roughly what browsers use for `line-height: normal`. */
  normalLineHeight: 1.2,
  /** Browsers round layout sizes, so 43.99 px counts as 44. */
  sizeTolerance: 0.5,
};

export const TARGET_SELECTOR = [
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

export type TargetSample = {
  inactive: boolean;
  blockTextLength: number;
  ownTextLength: number;
  blockLineHeight: string;
  blockFontSize: string;
  clipPath: string;
  display: string;
  firstLineHeight: number;
  height: number;
  width: number;
  name: string;
  overflow: string;
  pointerEvents: string;
  pseudos: { height: string; width: string }[];
  role: string;
  slot: string | undefined;
  visibility: string;
};

/** Reads nothing outside itself, so Playwright can send it with `page.evaluate`. */
export function sampleTargets(selector: string): TargetSample[] {
  return [...document.querySelectorAll<HTMLElement>(selector)].map((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    const ancestors = document.evaluate(
      "ancestor::*",
      element,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );

    const block =
      Array.from({ length: ancestors.snapshotLength }, (_, index) => ancestors.snapshotItem(index))
        .toReversed()
        .find(
          (node): node is HTMLElement =>
            node instanceof HTMLElement && getComputedStyle(node).display !== "inline",
        ) ?? document.body;

    const blockStyle = getComputedStyle(block);

    return {
      blockFontSize: blockStyle.fontSize,
      blockLineHeight: blockStyle.lineHeight,
      blockTextLength: block.textContent.trim().length,
      clipPath: style.clipPath,
      display: style.display,
      firstLineHeight: element.getClientRects()[0]?.height ?? rect.height,
      height: rect.height,
      inactive:
        element.matches(":disabled, [aria-disabled='true']") ||
        Boolean(element.closest("[inert], [aria-hidden='true']")),
      name: element.getAttribute("aria-label") ?? element.textContent.trim(),
      overflow: style.overflow,
      ownTextLength: element.textContent.trim().length,
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
  });
}

function toPixels(value: string): number {
  return Number(value.replace("px", "")) || 0;
}

/** Screen-reader-only controls and Base UI's slider input clip themselves to nothing. */
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
 * WCAG 2.5.8 exempts a target in running text, whose height comes from its line. A button in text
 * computes to `inline-block`.
 */
function isInText(sample: TargetSample): boolean {
  const lineHeight =
    toPixels(sample.blockLineHeight) ||
    toPixels(sample.blockFontSize) * TARGET_LIMITS.normalLineHeight;

  return (
    (sample.display === "inline" || sample.display === "inline-block") &&
    sample.blockTextLength > sample.ownTextLength &&
    sample.firstLineHeight <= lineHeight * TARGET_LIMITS.lineTolerance
  );
}

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

export function findSmallTargets(samples: TargetSample[]): string[] {
  const smallest = TARGET_LIMITS.min - TARGET_LIMITS.sizeTolerance;

  return samples.flatMap((sample) => {
    if (isHiddenTarget(sample) || isInText(sample)) {
      return [];
    }

    const size = getHitArea(sample);
    return size.height >= smallest && size.width >= smallest ? [] : [describeTarget(sample, size)];
  });
}

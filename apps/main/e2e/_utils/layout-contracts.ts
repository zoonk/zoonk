import { type Locator, expect } from "@playwright/test";

const WIDTH_ALIGNMENT_TOLERANCE = 2;
const MINIMUM_VERTICAL_GAP = 8;

/**
 * Reads a locator's rendered box so layout assertions can compare what users
 * actually see instead of coupling tests to class names or wrapper markup.
 */
async function getBoundingBox({ description, locator }: { description: string; locator: Locator }) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error(`Expected ${description} to have a bounding box`);
  }

  return box;
}

/**
 * Returns an element's rendered width for cross-scene layout checks.
 *
 * These tests protect the player's shared width contract by comparing visible
 * elements from different scene families rather than asserting exact pixels.
 */
export async function getRenderedWidth({
  description,
  locator,
}: {
  description: string;
  locator: Locator;
}) {
  const box = await getBoundingBox({ description, locator });
  return box.width;
}

/**
 * Verifies that a visible element matches a previously recorded reference
 * width within a small tolerance.
 *
 * The tolerance absorbs sub-pixel rounding while still failing if one scene
 * drifts away from the shared player frame.
 */
export async function expectWidthToMatch({
  description,
  expectedDescription,
  expectedWidth,
  locator,
  tolerance = WIDTH_ALIGNMENT_TOLERANCE,
}: {
  description: string;
  expectedDescription: string;
  expectedWidth: number;
  locator: Locator;
  tolerance?: number;
}) {
  const actualWidth = await getRenderedWidth({ description, locator });

  expect(
    Math.abs(actualWidth - expectedWidth),
    `${description} should match ${expectedDescription}`,
  ).toBeLessThanOrEqual(tolerance);
}

/**
 * Ensures sticky chrome leaves visible breathing room above the next content
 * block on small screens.
 *
 * This guards against mobile regressions where the shared header and the first
 * question block visually collide after scene refactors.
 */
export async function expectMinimumVerticalGap({
  lowerDescription,
  lowerLocator,
  minimumGap = MINIMUM_VERTICAL_GAP,
  upperDescription,
  upperLocator,
}: {
  lowerDescription: string;
  lowerLocator: Locator;
  minimumGap?: number;
  upperDescription: string;
  upperLocator: Locator;
}) {
  const [upperBox, lowerBox] = await Promise.all([
    getBoundingBox({ description: upperDescription, locator: upperLocator }),
    getBoundingBox({ description: lowerDescription, locator: lowerLocator }),
  ]);

  const gap = lowerBox.y - (upperBox.y + upperBox.height);

  expect(
    gap,
    `${lowerDescription} should leave space below ${upperDescription}`,
  ).toBeGreaterThanOrEqual(minimumGap);
}

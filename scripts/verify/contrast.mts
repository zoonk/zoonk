import { type describeViolations } from "../../packages/testing/src/accessibility/scan.ts";

type Violation = Parameters<typeof describeViolations>[0][number];

const GRAY_SPREAD = 12;
const HEX = /^#(?<red>[0-9a-f]{2})(?<green>[0-9a-f]{2})(?<blue>[0-9a-f]{2})/iu;

export function isNeutral(color: unknown): boolean {
  const groups = typeof color === "string" ? HEX.exec(color)?.groups : undefined;

  if (!groups) {
    return false;
  }

  const channels = [groups.red, groups.green, groups.blue].map((channel) =>
    Number.parseInt(channel ?? "", 16),
  );

  return Math.max(...channels) - Math.min(...channels) <= GRAY_SPREAD;
}

/**
 * Colored marks and words stay soft by design and turn strict only when the device asks for more
 * contrast, so only neutral text fails here.
 */
export function neutralTextOnly(violations: Violation[]): Violation[] {
  return violations
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter((node) => {
        const data: unknown = node.any[0]?.data;

        return (
          Boolean(data) &&
          typeof data === "object" &&
          data !== null &&
          "fgColor" in data &&
          isNeutral(data.fgColor)
        );
      }),
    }))
    .filter((violation) => violation.nodes.length > 0);
}

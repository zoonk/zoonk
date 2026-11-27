import { choiceItemContent } from "@zoonk/testing/fixtures/skills";

const options = choiceItemContent().options;
const RIGHT = options.find((option) => option.isCorrect)?.text ?? "";

/**
 * The tap on a fixture question's right option, or a wrong one, where the screen shows it: each
 * showing lays the options out in its own order, so a place says nothing about which is right.
 */
export function tapOption(
  shown: readonly string[] | null | undefined,
  { right = true }: { right?: boolean } = {},
): { selectedIndex: number } {
  const selectedIndex = (shown ?? []).findIndex((text) => (text === RIGHT) === right);

  if (selectedIndex === -1) {
    throw new Error(`Expected the fixture's options, got ${JSON.stringify(shown)}`);
  }

  return { selectedIndex };
}

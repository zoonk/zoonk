import { describe, expect, it } from "vitest";
import { render } from "../_test-utils/render";
import { OutcomeHistogram } from "../activities/random-simulation/chance-charts";

/** Two dice: every sum from 2 to 12 comes up at least once. */
const SUMS = [2, 3, 4, 5, 6, 7, 7, 7, 8, 9, 10, 11, 12];

function axisLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-slot="plot-axis-x"] text')].map(
    (label) => label.textContent ?? "",
  );
}

describe("a chance simulation's outcome chart", () => {
  it("labels the outcome the learner is after, between the first and the last", async () => {
    const { container } = render(
      <div style={{ width: 360 }}>
        <OutcomeHistogram allOutcomes={SUMS} isHit={(sum) => sum === 7} shownOutcomes={SUMS} />
      </div>,
    );

    await expect.poll(() => axisLabels(container)).toStrictEqual(["2", "7", "12"]);
  });
});

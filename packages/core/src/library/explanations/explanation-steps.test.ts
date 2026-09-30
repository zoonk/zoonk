import { describe, expect, it } from "vitest";
import { marketExplanation } from "./_test-utils/market-explanation";
import { toExplanationSteps } from "./explanation-steps";

describe(toExplanationSteps, () => {
  it("turns the story, the check and the recap into screens that pass the step contract", () => {
    const { problems, steps } = toExplanationSteps(marketExplanation());

    expect(problems).toStrictEqual([]);

    expect(steps.map((step) => step.kind)).toStrictEqual([
      "explanation",
      "explanation",
      "explanation",
      "explanation",
      "check",
      "summary",
    ]);

    expect(steps[0]?.content).toStrictEqual({
      image: { alt: "The market isn't one price", prompt: "A basket of company logos on a scale" },
      text: "“The market” is an **index**.",
      title: "The market isn't one price",
    });

    const check = steps[4]?.content as { options: { id: string; isCorrect: boolean }[] };

    // Shuffled so the right answer's position gives nothing away; ids follow the shown order.
    expect(check.options.map((option) => option.id)).toStrictEqual(["a", "b", "c"]);

    expect(check.options).toContainEqual({
      id: expect.any(String),
      isCorrect: true,
      reason: "Yes: the index is a basket of stocks.",
      text: "The basket is worth 2% more",
    });

    expect(check.options.filter((option) => option.isCorrect)).toHaveLength(1);

    expect(steps[5]?.content).toStrictEqual({
      ideas: [
        { text: "The market is an index." },
        { text: "Big companies weigh more." },
        { text: "Up 2% compares with yesterday's close." },
      ],
    });
  });

  it("reports an explanation whose check has two right answers", () => {
    const explanation = marketExplanation();

    const broken = {
      ...explanation,
      check: {
        ...explanation.check,
        options: explanation.check.options.map((option) => ({ ...option, isCorrect: true })),
      },
    };

    expect(toExplanationSteps(broken).problems).toContain(
      "The check has 3 correct options instead of 1.",
    );
  });
});

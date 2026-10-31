import { describe, expect, it, vi } from "vitest";
import { withItemRules } from "./item-rules";

vi.mock("./item-rules.prompt.md", () => ({
  default:
    "# Good\n\n- Concrete.{{FIELD_RULE}}\n- In `LANGUAGE`{{LANGUAGE_GOAL_EXCEPTION}}.\n\n{{LANGUAGE_GOALS}}\n\n# Text\n\n- Tables.\n{{PICTURES}}\n- No em dashes.\n\n# Formats\n\n{{FORMATS}}\n\n# Final check\n\nIn `LANGUAGE`{{LANGUAGE_GOAL_CHECK}}.\n",
}));

vi.mock("./item-rules/field.prompt.md", () => ({ default: "Set in `FIELD`.\n" }));

vi.mock("./item-rules/language-goals.prompt.md", () => ({
  default: "# Language goals\n\nPractice it.\n",
}));

vi.mock("./item-rules/pictures.prompt.md", () => ({ default: "- Charts.\n- Pictures.\n" }));
vi.mock("./item-rules/numeric-pictures.prompt.md", () => ({ default: "- No numeric pictures.\n" }));

vi.mock("./item-rules/multiple-choice.prompt.md", () => ({
  default:
    "## multipleChoice\n\n- Options{{#onePick}}, one correct{{/onePick}}{{#severalPicks}}, `SELECT` correct{{/severalPicks}}.\n",
}));

vi.mock("./item-rules/true-false.prompt.md", () => ({ default: "## trueFalse\n\n- Statement.\n" }));

vi.mock("./item-rules/typed-spoken.prompt.md", () => ({
  default: "## typed and spoken\n\n{{TYPED_QUESTION}}\n- Key points.\n",
}));

vi.mock("./item-rules/typed-question.prompt.md", () => ({ default: "- One clear ask.\n" }));

vi.mock("./item-rules/essay.prompt.md", () => ({ default: "## essay\n\n- Rubric.\n" }));
vi.mock("./item-rules/match-pairs.prompt.md", () => ({ default: "## matchPairs\n\n- Pairs.\n" }));
vi.mock("./item-rules/order.prompt.md", () => ({ default: "## order\n\n- Steps.\n" }));

vi.mock("./item-rules/numeric.prompt.md", () => ({
  default: "## numeric\n\n- Math.{{#numericEntry}}\n- `ENTRY`.{{/numericEntry}}\n",
}));

describe(withItemRules, () => {
  it("gives a field's multiple-choice writer its format, pictures and field rule, and nothing else", () => {
    expect(
      withItemRules("# Role", { field: true, formats: ["multipleChoice"], languageGoal: false }),
    ).toBe(
      [
        "# Role",
        "# Good\n\n- Concrete. Set in `FIELD`.\n- In `LANGUAGE`.\n",
        "# Text\n\n- Tables.\n- Charts.\n- Pictures.\n- No em dashes.\n",
        "# Formats\n\n## multipleChoice\n\n- Options, one correct.\n",
        "# Final check\n\nIn `LANGUAGE`.\n",
      ].join("\n"),
    );
  });

  it("gives an essay writer only the essay rules, with no pictures, field or language goal", () => {
    const prompt = withItemRules("# Role", {
      field: false,
      formats: ["essay"],
      languageGoal: false,
    });

    expect(prompt).toContain("- Concrete.\n- In `LANGUAGE`.\n\n# Text");
    expect(prompt).toContain("- Tables.\n- No em dashes.");
    expect(prompt).toContain("# Formats\n\n## essay\n\n- Rubric.\n\n# Final check");

    expect(prompt).not.toMatch(
      /Options|Statement|One clear ask|Key points|Pairs|Steps|Math|Pictures|FIELD/u,
    );

    expect(prompt).not.toContain("{{");
  });

  it("tells a numeric writer its questions never point at a picture, without the picture rules", () => {
    const prompt = withItemRules("# Role", {
      field: false,
      formats: ["numeric"],
      languageGoal: false,
    });

    expect(prompt).toContain("- Tables.\n- No numeric pictures.\n- No em dashes.");
    expect(prompt).not.toContain("- Charts.");
  });

  it("gives a language goal's writer the language rules, and its formats in the rules' order", () => {
    const prompt = withItemRules("# Role", {
      field: false,
      formats: ["typed", "multipleChoice"],
      languageGoal: true,
    });

    expect(prompt).toContain(
      '- In `LANGUAGE`, except the language practiced in a language goal (see "Language goals").',
    );

    expect(prompt).toContain("\n\n# Language goals\n\nPractice it.\n\n# Text");

    expect(prompt).toContain(
      "## multipleChoice\n\n- Options, one correct.\n\n## typed and spoken\n\n- One clear ask.\n- Key points.",
    );

    expect(prompt).toContain(
      "In `LANGUAGE` (in a language goal, the practiced language is in `TARGET_LANGUAGE`).",
    );
  });

  it("shares the typed rules with spoken questions, which show no pictures", () => {
    const prompt = withItemRules("# Role", {
      field: false,
      formats: ["spoken"],
      languageGoal: false,
    });

    expect(prompt).toContain("## typed and spoken");
    expect(prompt).not.toContain("- Charts.");
  });

  it("gives several picks' and an answer box's rules only to a call whose exam asks that way", () => {
    const quick = withItemRules("# Role", {
      field: false,
      formats: ["multipleChoice", "numeric"],
      languageGoal: false,
    });

    expect(quick).toContain("- Options, one correct.\n");
    expect(quick).toContain("- Math.\n");
    expect(quick).not.toMatch(/SELECT|ENTRY|\{\{/u);

    const exam = withItemRules("# Role", {
      field: false,
      formats: ["multipleChoice", "numeric"],
      languageGoal: false,
      numericEntry: true,
      severalPicks: true,
    });

    expect(exam).toContain("- Options, `SELECT` correct.\n");
    expect(exam).toContain("- Math.\n- `ENTRY`.\n");
  });

  it("leaves the picture rules out for questions that share a set's stimulus", () => {
    const prompt = withItemRules("# Role", {
      field: false,
      formats: ["multipleChoice"],
      languageGoal: false,
      pictures: false,
    });

    expect(prompt).toContain("- Tables.\n- No em dashes.");
    expect(prompt).not.toMatch(/Charts|Pictures/u);
  });
});

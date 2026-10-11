import { describe, expect, it } from "vitest";
import { selectPromptVariants } from "./prompt-variants";

describe(selectPromptVariants, () => {
  it("keeps a block on its own lines for its variant and drops it, lines included, otherwise", () => {
    const template = "# Rules\n\n{{#exam}}\nExam rule.\n\n{{/exam}}\nShared rule.\n";

    expect(selectPromptVariants({ template, variants: { exam: true } })).toBe(
      "# Rules\n\nExam rule.\n\nShared rule.\n",
    );

    expect(selectPromptVariants({ template, variants: { exam: false } })).toBe(
      "# Rules\n\nShared rule.\n",
    );
  });

  it("keeps or drops a block inside a sentence", () => {
    const template = "Verify{{#exam}}, for the part asked,{{/exam}} that keys exist.";

    expect(selectPromptVariants({ template, variants: { exam: true } })).toBe(
      "Verify, for the part asked, that keys exist.",
    );

    expect(selectPromptVariants({ template, variants: { exam: false } })).toBe(
      "Verify that keys exist.",
    );
  });

  it("reads a block inside another only when the outer one is kept", () => {
    const template = "A{{#exam}} B{{#budget}} C{{/budget}} D{{/exam}} E";

    expect(selectPromptVariants({ template, variants: { budget: true, exam: true } })).toBe(
      "A B C D E",
    );

    expect(selectPromptVariants({ template, variants: { budget: false, exam: true } })).toBe(
      "A B D E",
    );

    expect(selectPromptVariants({ template, variants: { budget: true, exam: false } })).toBe("A E");
  });

  it("rejects a block for a variant the call doesn't know", () => {
    expect(() =>
      selectPromptVariants({ template: "{{#exm}}Exam rule.{{/exm}}", variants: { exam: true } }),
    ).toThrow("exm");
  });

  it("rejects a block that is never closed", () => {
    expect(() =>
      selectPromptVariants({ template: "{{#exam}}Exam rule.", variants: { exam: true } }),
    ).toThrow();
  });
});

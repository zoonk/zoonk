import { math } from "@streamdown/math";
import remarkParse from "remark-parse";
import { defaultRemarkPlugins } from "streamdown";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

const CASES = [
  String.raw`$$\frac{1}{2} x^2$$`,
  "$$x^2 + 1$$",
  String.raw`$$\{a, b\} \cup \{c\}$$`,
  "$$2*3*4 = 24$$",
  "$$\nv = \\sqrt{2gh}\n$$",
  "The speed is:\n\n$$\nv = \\sqrt{2gh}\n$$\n\nso it grows with height.",
  String.raw`The area is $$\frac{1}{2} x^2$$ here.`,
  "It costs $5, or $10 with tax.",
  "Let $x$ be even.",
  "Write `$$x^2$$` to typeset it.",
  "```\n$$x^2$$\n```",
  "The sum $$x + 1 never closes.",
  "Compare $$a^2$$ with $$b^2$$.",
  "- First, $$x^2$$\n- Then the rest",
  "**Bold** words, a [link](https://example.com) and $$E = mc^2$$ in one answer.",
] as const;

type MarkdownNode = { children?: MarkdownNode[]; type: string; value?: string };

function collectFormulas(node: MarkdownNode): { display: boolean; latex: string }[] {
  if (node.type === "math" || node.type === "inlineMath") {
    return [{ display: node.type === "math", latex: node.value ?? "" }];
  }

  return (node.children ?? []).flatMap((child) => collectFormulas(child));
}

/** The remark plugins `TutorMarkdown`'s Streamdown runs, in its order. */
const parser = unified()
  .use(remarkParse)
  .use(Object.values(defaultRemarkPlugins))
  .use([math.remarkPlugin]);

describe("buddy math as native apps must find it", () => {
  it("lists the formulas the web typesets in each answer", async () => {
    const cases = CASES.map((text) => ({
      formulas: collectFormulas(parser.runSync(parser.parse(text))),
      text,
    }));

    await expect(`${JSON.stringify({ cases }, null, 2)}\n`).toMatchFileSnapshot(
      "tutor-math-native-fixtures.json",
    );
  });
});

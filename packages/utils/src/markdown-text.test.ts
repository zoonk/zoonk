import { describe, expect, it } from "vitest";
import { markdownToPlainText } from "./markdown-text";

describe(markdownToPlainText, () => {
  it("keeps formatted labels and separates blocks without Markdown syntax", () => {
    expect(
      markdownToPlainText(
        "# **Lysosomes**\n\n[Preferences](/settings/appearance) and `code`\n\n- One\n- Two",
      ),
    ).toBe("Lysosomes Preferences and code One Two");
  });

  it("handles reference links, images, escapes, entities and GFM", () => {
    expect(
      markdownToPlainText(
        "~~Old~~ [label][ref] ![alt](image.png) \\*literal\\* &amp;\n\n[ref]: /settings",
      ),
    ).toBe("Old label alt *literal* &");
  });

  it("separates table cells and hard breaks and omits raw HTML", () => {
    expect(
      markdownToPlainText(
        "| A | B |\n| --- | --- |\n| C | D |\n\nfirst  \nsecond\n\n<script>hidden</script>",
      ),
    ).toBe("A B C D first second");
  });
});

import { type Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { describe, expect, it } from "vitest";
import { keepAllowedMarkdownLinks } from "./markdown-links";

const ALLOWED = new Set(["/today", "/session?block=0199a8f2-6a1e-7c3d-9b0a-1d2e3f4a5b6c"]);

function sanitize(markdown: string) {
  return keepAllowedMarkdownLinks({ isAllowed: (href) => ALLOWED.has(href), markdown });
}

/** Every destination GFM reads as a link (or an image) in a text. */
function readLinks(markdown: string): string[] {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  const links: string[] = [];

  const visit = (node: Nodes) => {
    if (node.type === "link" || node.type === "image" || node.type === "definition") {
      links.push(node.url);
    }

    if (node.type === "linkReference" || node.type === "imageReference") {
      links.push(`ref:${node.identifier}`);
    }

    if (node.type === "html") {
      links.push(`html:${node.value}`);
    }

    if ("children" in node) {
      node.children.forEach((child) => visit(child as Nodes));
    }
  };

  visit(tree);
  return links;
}

describe(keepAllowedMarkdownLinks, () => {
  it("keeps a link the answer was given and turns any other into its words", () => {
    expect(
      sanitize("Comece por **[Átomos](/today)**, depois [veja aqui](https://example.com/x)."),
    ).toStrictEqual({
      kept: ["/today"],
      markdown: "Comece por **[Átomos](/today)**, depois veja aqui.",
      removed: ["https://example.com/x"],
    });
  });

  it("writes an allowed reference link inline and drops every definition", () => {
    const { markdown } = sanitize(
      "Open [today][t] or [the site][s].\n\n[t]: /today\n[s]: https://example.com",
    );

    expect(markdown.trim()).toBe("Open [today](/today) or the site.");
    expect(readLinks(markdown)).toStrictEqual(["/today"]);
  });

  it.each([
    "<https://example.com/a>",
    "See https://example.com/a now",
    "See www.example.com now",
    "Write to someone@example.com",
    "[/today](javascript:alert(1))",
    "[a path the app never gave](/admin)",
  ])("leaves no link to anywhere else in %j", (markdown) => {
    const result = sanitize(markdown);

    expect(readLinks(result.markdown)).toStrictEqual([]);
    expect(result.kept).toStrictEqual([]);
  });

  it("writes a bare address that is no longer a link as code, so it reads as the same words", () => {
    expect(sanitize("See https://example.com/a now").markdown).toBe(
      "See ` https://example.com/a ` now",
    );
  });

  it("turns images into their alt text and removes raw HTML", () => {
    const { markdown } = sanitize(
      'Look: ![a diagram](https://example.com/a.png) and <a href="https://example.com">here</a>.',
    );

    expect(markdown).toBe("Look: a diagram and here.");
    expect(readLinks(markdown)).toStrictEqual([]);
  });

  it("leaves math, code and everything else exactly as written", () => {
    const markdown = [
      "**Bold** and a list:",
      "",
      "- one",
      "- two",
      "",
      String.raw`$$\frac{1}{2} \{x\}$$`,
      "",
      "`[x](https://example.com)`",
      "",
      "| a | b |",
      "| - | - |",
      "| 1 | 2 |",
    ].join("\n");

    expect(sanitize(markdown).markdown).toBe(markdown);
  });

  it("keeps an allowed link inside an otherwise unchanged sentence", () => {
    const block = [...ALLOWED][1] ?? "";

    expect(sanitize(`Tap [Por que o elétron não cai no núcleo?](${block}).`).markdown).toBe(
      `Tap [Por que o elétron não cai no núcleo?](${block}).`,
    );
  });

  it.each([
    "[[fake](https://removed.example)](/plan/invented)",
    "[fake]<i></i>(/plan/invented)",
    "[https&#58;&#47;&#47;evil.example](https://removed.example)",
    "[link](https://removed.example)(/plan/invented)",
    String.raw`![\[x\](/plan/invented)](https://example.com/a.png)`,
    String.raw`[![\[x\](https://example.com)](https://example.com/a.png)](/today)`,
  ])("never leaves a link it didn't check in %j", (markdown) => {
    const result = sanitize(markdown);
    const links = readLinks(result.markdown);

    expect(links.every((href) => ALLOWED.has(href))).toBe(true);
    expect(result.kept.toSorted()).toStrictEqual(links.toSorted());
  });

  it("keeps a table's cells when an image in one becomes its words", () => {
    const { markdown } = sanitize(
      "| ![A\\|B](https://example.com/a.png) | c |\n| - | - |\n| 1 | 2 |",
    );

    const tree = fromMarkdown(markdown, {
      extensions: [gfm()],
      mdastExtensions: [gfmFromMarkdown()],
    });

    const [table] = tree.children;

    expect(table?.type === "table" && table.children[0]?.children.length).toBe(2);
  });
});

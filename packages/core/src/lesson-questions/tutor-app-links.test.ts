import { describe, expect, it } from "vitest";
import { createAnswerLinks, isTutorAppPath } from "./tutor-app-links";

const { toLink } = createAnswerLinks([]).links;

const BLOCK_ID = "0199a8f2-6a1e-7c3d-9b0a-1d2e3f4a5b6c";

describe(createAnswerLinks, () => {
  it("keeps the links the answer was given and makes every other one its words", () => {
    const { checkLinks, links } = createAnswerLinks(["plan", "today"]);
    const given = links.toLink({ blockId: BLOCK_ID, kind: "block" });

    expect(
      checkLinks(
        `Comece por [Átomos](${given}), veja [o plano](/plan), [este desafio](/challenge/${BLOCK_ID}) e [o site](https://example.com).`,
      ).markdown,
    ).toBe(
      `Comece por [Átomos](/session?block=${BLOCK_ID}), veja [o plano](/plan), este desafio e o site.`,
    );
  });

  it("never keeps a page its guide didn't list", () => {
    const { checkLinks } = createAnswerLinks(["settings"]);

    expect(checkLinks("Veja [o plano](/plan) e [as configurações](/settings).").markdown).toBe(
      "Veja o plano e [as configurações](/settings).",
    );
  });
});

describe(isTutorAppPath, () => {
  it.each([
    toLink({ blockId: BLOCK_ID, kind: "block" }),
    toLink({ kind: "challenge", planItemId: BLOCK_ID }),
    toLink({ key: "matematica", kind: "subject" }),
    toLink({ kind: "page", page: "mistakes" }),
  ])("takes the app's own link %s", (href) => {
    expect(isTutorAppPath(href)).toBe(true);
  });

  it.each([
    "https://example.com",
    "//example.com/plan",
    "/admin",
    "/session?block=not-an-id",
    `/session?block=${BLOCK_ID}&next=https://example.com`,
    "/plan/a/b",
    ["javascript", "alert(1)"].join(":"),
  ])("refuses %s", (href) => {
    expect(isTutorAppPath(href)).toBe(false);
  });
});

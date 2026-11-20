/* oxlint-disable unicorn/consistent-function-scoping -- The probe is sent to the page as one function. */
import { type Finding } from "./checks.mts";

export type RoleFacts = { backLinksWithoutText: number; gates: number; unmarkedEyebrows: string[] };

export function readRoleFacts(): RoleFacts {
  const { shown } = globalThis.zoonkPage;

  const visible = (selector: string) =>
    [...document.querySelectorAll(selector)].filter((element) => shown(element));

  const written = (element: Element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const text: string[] = [];

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (
        node.parentElement &&
        shown(node.parentElement) &&
        !node.parentElement.closest("svg, [aria-hidden=true]")
      ) {
        const range = document.createRange();
        range.selectNodeContents(node);

        if ([...range.getClientRects()].some((box) => box.width > 0 && box.height > 0)) {
          text.push(node.textContent?.trim() ?? "");
        }
      }
    }

    return text.join(" ").trim();
  };

  return {
    backLinksWithoutText: visible("[data-slot=back-link]").filter((link) => !written(link)).length,
    gates: visible("[data-slot=subscribe-gate]").length,
    unmarkedEyebrows: visible("[data-slot=page-title], h1")
      .filter((title) => title.closest("header, [data-slot=page-header], [data-slot=page-top]"))
      .flatMap((title) => {
        const previous = title.previousElementSibling;

        return previous &&
          shown(previous) &&
          previous.matches("p, span, div") &&
          !previous.matches("[data-slot=eyebrow]") &&
          !previous.querySelector("a, button, input, [role], [data-slot=eyebrow]") &&
          written(previous)
          ? [written(previous)]
          : [];
      }),
  };
}

export function roleFindings(facts: RoleFacts): Finding[] {
  return [
    ...(facts.gates > 1
      ? [
          {
            check: "R4 one subscription gate",
            level: "warn" as const,
            message: `${facts.gates} subscription gates are drawn on this screen; the gate appears once when the learner tries the feature`,
          },
        ]
      : []),
    ...(facts.backLinksWithoutText > 0
      ? [
          {
            check: "E8 named back link",
            level: "warn" as const,
            message: `${facts.backLinksWithoutText} back links have no drawn text naming their destination`,
          },
        ]
      : []),
    ...facts.unmarkedEyebrows.map((label) => ({
      check: "R3 eyebrow piece",
      level: "warn" as const,
      message: `"${label}" is text directly above the title, outside [data-slot=eyebrow]`,
    })),
  ];
}

/* oxlint-disable unicorn/consistent-function-scoping -- The probe is sent to the page as one function. */
import { type Finding } from "./checks.mts";

export type RoleFacts = {
  backLinksWithoutText: number;
  gates: number;
  mainActionsOutsideBar: string[];
  unmarkedEyebrows: string[];
};

export function readRoleFacts(): RoleFacts {
  const shown = (element: Element) =>
    element.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
    element.getBoundingClientRect().width > 0 &&
    element.getBoundingClientRect().height > 0;

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

  const main = document.querySelector("main");

  const actions = visible("[data-enter=bound], [data-enter=host]").filter(
    (element) => main?.contains(element) && !element.matches(":disabled, [aria-disabled=true]"),
  );

  return {
    backLinksWithoutText: visible("[data-slot=back-link]").filter((link) => !written(link)).length,
    gates: visible("[data-slot=subscription-gate]").length,
    mainActionsOutsideBar:
      actions.length === 1
        ? actions
            .filter((action) => !action.closest("[data-slot=bottom-bar]"))
            .map((action) => written(action))
        : [],
    unmarkedEyebrows: visible("[data-slot=page-title], h1")
      .filter((title) => title.closest("header, [data-slot=page-header], [data-slot=page-top]"))
      .flatMap((title) => {
        const previous = title.previousElementSibling;

        return previous &&
          shown(previous) &&
          previous.matches("p, span, [data-slot=page-eyebrow], [data-slot=detail-eyebrow]") &&
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
            check: "I5 named back link",
            level: "warn" as const,
            message: `${facts.backLinksWithoutText} back links have no drawn text naming their destination`,
          },
        ]
      : []),
    ...facts.mainActionsOutsideBar.map((label) => ({
      check: "R2 main action in bottom bar",
      level: "warn" as const,
      message: `"${label}" is the one main action but is outside [data-slot=bottom-bar]`,
    })),
    ...facts.unmarkedEyebrows.map((label) => ({
      check: "R3 eyebrow piece",
      level: "warn" as const,
      message: `"${label}" is text directly above the title, outside [data-slot=eyebrow]`,
    })),
  ];
}

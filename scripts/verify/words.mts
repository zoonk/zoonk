import { type Finding } from "./checks.mts";

/** Zoonk-design's Words budget, as leads for a designer: none of them fails a run. */
export const WORD_BUDGET = {
  /** Text elements between a page's title and its main action. */
  aboveAction: 4,
  buttonWords: 3,
  /** Words on a page with a main action, which asks the learner to decide. */
  decisionWords: 60,
  /** Words gained since the baseline, as a share. */
  growth: 0.2,
  stringWords: 20,
};

type PagePlace = {
  /** Whether the one main action is pinned (fixed or sticky) in the screen's lower half; null without exactly one. */
  actionPinned: boolean | null;
  /** Null without a page header, or inside task and onboarding frames. */
  titleTop: { actual: number; expected: number | null } | null;
};

export type PageText = PagePlace & {
  aboveAction: number | null;
  action: string | null;
  buttons: string[];
  text: string;
};

export type PageWords = PagePlace & {
  aboveAction: number | null;
  action: string | null;
  kind: PageKind;
  longestButton: string | null;
  words: number;
};

/**
 * Runs in the browser, so it reads nothing outside itself (`probe.mts`). A button is drawn with
 * the design system's `buttonVariants` (its `group/button` class) and isn't underlined like a link.
 * The title is the main region's first `h1`, or the region's start without one; a main action
 * carries `data-enter`. A text element has its own text and isn't inside another one counted.
 */
export function readWords(): PageText {
  const { shown, pixels } = globalThis.zoonkPage;
  const main = document.querySelector("main") ?? document.body;
  const all = [...document.body.querySelectorAll("*")];

  const buttons = [...document.querySelectorAll<HTMLElement>(String.raw`.group\/button`)].filter(
    (button) => shown(button) && !getComputedStyle(button).textDecorationLine.includes("underline"),
  );

  const title = [...main.querySelectorAll("h1")].find((heading) => shown(heading)) ?? null;
  const start = all.indexOf(title ?? main);

  const scope = main.closest("[data-slot=task-frame]") ?? main;

  const actions = [...scope.querySelectorAll<HTMLElement>("[data-enter]")].filter((element) =>
    shown(element),
  );

  const action = actions.find((button) => all.indexOf(button) > start) ?? null;

  function titlePlace(): PagePlace["titleTop"] {
    if (!title || title.closest("[data-slot=task-frame], [data-slot=onboarding-frame]")) {
      return null;
    }

    const header = title.closest(
      "[data-slot=page-header-content], [data-slot=page-header], [data-slot=detail-hero], header",
    );

    if (!header) {
      return null;
    }

    const frame = title.closest("[data-slot=learn-shell-content]") ?? main;

    const bar = [...frame.querySelectorAll("[data-slot=page-top-bar]")].find((element) =>
      shown(element),
    );

    const style = getComputedStyle(header);

    return {
      actual: title.getBoundingClientRect().top - frame.getBoundingClientRect().top,
      expected: bar
        ? bar.getBoundingClientRect().height +
          pixels(style.paddingTop) +
          pixels(style.borderTopWidth)
        : null,
    };
  }

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- The probe is sent as one function.
  function pinned(element: Element) {
    const box = element.getBoundingClientRect();

    if (box.top < 0 || box.bottom > innerHeight || box.bottom <= innerHeight / 2) {
      return false;
    }

    for (let current: Element | null = element; current; current = current.parentElement) {
      if (["fixed", "sticky"].includes(getComputedStyle(current).position)) {
        return true;
      }
    }

    return false;
  }

  function beforeAction(button: HTMLElement | null) {
    if (!button) {
      return [];
    }

    const bar = button.closest("[data-slot=bottom-bar]");

    if (bar && pinned(bar) && pinned(button)) {
      return [];
    }

    return all
      .slice(start + 1, all.indexOf(button))
      .filter(
        (element) =>
          !title?.contains(element) &&
          !element.contains(button) &&
          [...element.childNodes].some(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          ) &&
          shown(element),
      );
  }

  const between = beforeAction(action);

  const [only] = actions;
  const bar = only?.closest("[data-slot=bottom-bar]");

  return {
    aboveAction: action
      ? between.filter(
          (element, index) => !between.slice(0, index).some((outer) => outer.contains(element)),
        ).length
      : null,
    action: action ? globalThis.zoonkPage.label(action, true) : null,
    actionPinned: actions.length === 1 && only ? Boolean(bar && pinned(bar) && pinned(only)) : null,
    buttons: buttons.map((button) => globalThis.zoonkPage.label(button, true)).filter(Boolean),
    // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- Only `innerText` skips hidden text (`display: none`), which `textContent` would count.
    text: main.innerText,
    titleTop: titlePlace(),
  };
}

/**
 * The budget is for the product's own screens. Long-form pages (a lesson's text, the legal pages)
 * are read, not decided on, and marketing pages (the landing page, the catalog, pricing, shared
 * links, the blog) are for visitors deciding whether to try Zoonk: both report their counts
 * without leads.
 */
export type PageKind = "app" | "long-form" | "marketing";

const LONG_FORM_PATH =
  /^(?:\/[a-z]{2})?\/(?:commercial-disclosure|learn|privacy|terms)(?:[/?#]|$)|\/l\/[^/?#]+\/?(?:[?#]|$)/u;

const MARKETING_PATH =
  /^(?:\/[a-z]{2})?(?:\/?(?:[?#]|$)|\/(?:b|blog|c|catalog-not-found|courses|plan-link|pricing)(?:[/?#]|$))/u;

export function pageKind(app: string, path: string): PageKind {
  if (LONG_FORM_PATH.test(path)) {
    return "long-form";
  }

  return app === "blog" || (app === "main" && MARKETING_PATH.test(path)) ? "marketing" : "app";
}

/** A word has a letter or a digit, so a dot, a dash or an arrow between words isn't one. */
export function countWords(text: string): number {
  return text.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export function summarizeWords(page: PageText, kind: PageKind): PageWords {
  const longestButton = page.buttons.reduce<string | null>(
    (longest, label) =>
      longest === null || countWords(label) > countWords(longest) ? label : longest,
    null,
  );

  return {
    aboveAction: page.aboveAction,
    action: page.action,
    actionPinned: page.actionPinned,
    kind,
    longestButton,
    titleTop: page.titleTop,
    words: countWords(page.text),
  };
}

/**
 * R2 on one load: a screen's one main action is pinned in the bottom bar. A
 * screen that keeps it elsewhere says why in its decisions, so this is a lead.
 */
export function placeFindings(page: PageWords): Finding[] {
  return page.kind !== "marketing" && page.actionPinned === false
    ? [
        {
          check: "R2 main action pinned",
          level: "warn",
          message: `"${page.action ?? ""}" is the screen's one main action and isn't pinned in the bottom bar`,
        },
      ]
    : [];
}

/** Shared page headers use the drawn bar; task and centered form tops have their own placement. */
export function titleTopFindings(page: PageWords): Finding[] {
  if (page.kind !== "app" || !page.titleTop) {
    return [];
  }

  const { actual, expected } = page.titleTop;

  if (expected === null) {
    return [
      {
        check: "E8 page top",
        level: "warn",
        message: "the page title has no visible shared page-top-bar",
      },
    ];
  }

  const rounding = 1;

  return Math.abs(actual - expected) > rounding
    ? [
        {
          check: "E8 page top",
          level: "warn",
          message: `the title starts ${actual} px below the page frame's top; its page-top-bar expects ${expected} px`,
          unit: "px",
          value: actual - expected,
        },
      ]
    : [];
}

export function wordFindings(page: PageWords): Finding[] {
  const budgeted = page.kind === "app" && page.aboveAction !== null;

  return [
    ...(budgeted && (page.aboveAction ?? 0) > WORD_BUDGET.aboveAction
      ? [
          {
            check: "text before the action",
            level: "warn" as const,
            message: `over ${WORD_BUDGET.aboveAction} text elements between the title and the main action: which would a learner miss?`,
            value: page.aboveAction ?? 0,
          },
        ]
      : []),
    ...(budgeted && page.words > WORD_BUDGET.decisionWords
      ? [
          {
            check: "words",
            level: "warn" as const,
            message: `over ${WORD_BUDGET.decisionWords} words on a page that asks for a decision`,
            unit: "words",
            value: page.words,
          },
        ]
      : []),
    ...(page.kind !== "marketing" &&
    page.longestButton &&
    countWords(page.longestButton) > WORD_BUDGET.buttonWords
      ? [
          {
            check: "button label",
            level: "warn" as const,
            message: `"${page.longestButton}" is over ${WORD_BUDGET.buttonWords} words`,
          },
        ]
      : []),
  ];
}

const PERCENT = 100;

export function wordGrowth(was: PageWords | undefined, now: PageWords): Finding[] {
  if (
    !was ||
    was.words === 0 ||
    now.kind !== "app" ||
    now.words <= was.words * (1 + WORD_BUDGET.growth)
  ) {
    return [];
  }

  return [
    {
      check: "words",
      level: "warn",
      message: `grew by more than ${WORD_BUDGET.growth * PERCENT}% since the baseline: does a learner need what was added?`,
      unit: "%",
      value: Math.round((now.words / was.words - 1) * PERCENT),
    },
  ];
}

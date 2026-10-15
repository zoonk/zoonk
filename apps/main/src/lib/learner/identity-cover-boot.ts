import {
  type IdentityCover,
  type IdentityHandoff,
  type IdentityTransition,
} from "./identity-cover";
import {
  type IdentityResetState,
  type decideIdentityReset,
  type parseIdentityResetGuard,
} from "./identity-reset-guard";

/**
 * The cover's words in the page's language, its buttons' classes (the first choice and a second one
 * beside it), its label's look (quiet while it checks, the screen's message when something
 * happened), the guard's key and the session hint's
 * grammar (`@zoonk/auth/session-hint`'s constants, so the inline copy of its parse can't drift).
 */
export type IdentityCoverConfig = {
  buttonClassName: { primary: string; secondary: string };
  copy: { checking: string; failed: string; outOfDate: string; reload: string; tryAgain: string };
  coverId: string;
  guardKey: string;
  hint: { cookie: string; none: string; tag: { flags: string; source: string } };
  labelClassName: { checking: string; message: string };
};

/** The cover plane's id: its style, its controls and the input checks that let them through. */
export const IDENTITY_COVER_ID = "zoonk-cover";

/** The pieces the bootstrap runs with: each one is serialized into the page with it. */
export type IdentityCoverParts = {
  buildPlane: typeof buildIdentityCoverPlane;
  decideReset: typeof decideIdentityReset;
  parseGuard: typeof parseIdentityResetGuard;
  readGuard: typeof readIdentityResetGuard;
  readHint: typeof readIdentityCoverHint;
};

/**
 * The cover as the page's parse-time bootstrap installs it, before the store loads: the port the
 * store drives, a private boundary's witness (`witness`) and, once, what was found before the
 * store took over (`takeHandoff`, which also says where later witnesses go).
 */
type IdentityCoverRuntime = IdentityCover & {
  takeHandoff: (onWitness: (tag: string) => void) => IdentityHandoff;
  witness: (tag: string) => void;
};

/** What the cover can say: checking, a failed check, or a page that's out of date. */
type CoverState = "checking" | "failed" | "outOfDate" | "outOfDateManual";

/** What the cover keeps for the document's lifetime. */
type CoverPage = {
  covered: boolean;
  observer: MutationObserver | null;
  onWitness: ((tag: string) => void) | null;
  priorFocus: Element | null;
  reset: IdentityResetState;
  retry: (() => void) | null;
  transition: IdentityTransition | null;
  witnesses: string[];
};

declare global {
  /** On `globalThis` so the private boundaries' inline witnesses reach it before the store loads. */
  var zoonkIdentityCover: IdentityCoverRuntime | undefined;
}

/**
 * The cover's one plane, outside `<body>` (React never renders or keeps it): an opaque layer over
 * everything and, in the viewport, a labelled dialog that says what's happening and offers what
 * the learner can do (try again, reload). It's serialized into the page.
 */
export function buildIdentityCoverPlane(config: IdentityCoverConfig) {
  const plane = document.createElement("div");
  const panel = document.createElement("div");
  const label = document.createElement("p");
  const tryAgain = document.createElement("button");
  const reload = document.createElement("button");

  plane.id = config.coverId;
  panel.className = "font-sans antialiased";
  panel.tabIndex = -1;
  panel.setAttribute("role", "alertdialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", `${config.coverId}-label`);
  label.id = `${config.coverId}-label`;
  label.className = config.labelClassName.checking;
  label.setAttribute("aria-live", "polite");
  label.textContent = config.copy.checking;
  tryAgain.textContent = config.copy.tryAgain;
  reload.textContent = config.copy.reload;

  [tryAgain, reload].forEach((button) => {
    button.type = "button";
    button.className = config.buttonClassName.primary;
    button.hidden = true;
  });

  panel.append(label, tryAgain, reload);
  plane.append(panel);
  document.documentElement.append(plane);

  return { label, panel, plane, reload, tryAgain };
}

/**
 * The session hint as a learner's tag, null for nobody, undefined when it names no learner
 * (absent, a legacy value, malformed), by the grammar the bundled reader uses. It's serialized
 * into the page.
 */
export function readIdentityCoverHint(
  hint: IdentityCoverConfig["hint"],
): string | null | undefined {
  const prefix = `${hint.cookie}=`;

  const value = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);

  if (value === undefined || value === hint.none) {
    return value === undefined ? undefined : null;
  }

  return new RegExp(hint.tag.source, hint.tag.flags).test(value) ? value : undefined;
}

/**
 * Takes the reset guard a reload left, once, before any witness. It only matters at the page's
 * first reset decision. Storage that throws says nothing about the learner; it only keeps this
 * document's resets manual. It's serialized into the page.
 */
export function readIdentityResetGuard({
  key,
  parseGuard,
}: {
  key: string;
  parseGuard: typeof parseIdentityResetGuard;
}): Pick<IdentityResetState, "consumed" | "readFailed" | "removeFailed"> {
  try {
    const raw = sessionStorage.getItem(key);
    const consumed = parseGuard(raw);

    if (raw === null) {
      return { consumed, readFailed: false, removeFailed: false };
    }

    try {
      sessionStorage.removeItem(key);
      return { consumed, readFailed: false, removeFailed: false };
    } catch {
      return { consumed, readFailed: false, removeFailed: consumed !== null };
    }
  } catch {
    return { consumed: null, readFailed: true, removeFailed: false };
  }
}

/**
 * Installs the identity cover while the document is still parsing (an inline script in the root
 * layout's `<head>`), with the keyboard kept away from the page while covered. Private
 * boundaries' witnesses report here before the store exists: one whose tag isn't the browser's
 * hint (or a second owner) covers the page before that boundary paints, and the store decides the
 * reset once it loads. The store decides; this only draws the cover and reloads. It's serialized
 * into the page, so it uses nothing outside itself and its arguments.
 */
export function bootIdentityCover(config: IdentityCoverConfig, parts: IdentityCoverParts): void {
  const COVERED = "data-zoonk-cover";
  const root = document.documentElement;
  const { label, panel, plane, reload, tryAgain } = parts.buildPlane(config);

  const readHint = () => parts.readHint(config.hint);
  const seen = readHint();
  const guard = parts.readGuard({ key: config.guardKey, parseGuard: parts.parseGuard });

  const page: CoverPage = {
    covered: false,
    observer: null,
    onWitness: null,
    priorFocus: null,
    reset: { ...guard, decided: false, manual: null },
    retry: null,
    transition: null,
    witnesses: [],
  };

  const writeGuard = (transition: IdentityTransition) => {
    try {
      sessionStorage.setItem(config.guardKey, JSON.stringify({ ...transition, version: 1 }));
      return true;
    } catch {
      return false;
    }
  };

  /** Puts back what React or anything else removed or changed: it writes only what differs. */
  const repair = () => {
    if (plane.parentNode !== root) {
      root.append(plane);
    }

    if (!root.hasAttribute(COVERED)) {
      root.setAttribute(COVERED, "");
    }

    if (document.body && !document.body.inert) {
      document.body.inert = true;
      page.observer?.observe(document.body, { attributeFilter: ["inert"], attributes: true });
    }

    if (!plane.contains(document.activeElement)) {
      panel.focus({ preventScroll: true });
    }
  };

  /** What the cover says and offers; its first button takes the focus. */
  const show = (state: CoverState) => {
    const buttons: HTMLButtonElement[] = {
      checking: [],
      failed: [tryAgain, reload],
      outOfDate: [],
      outOfDateManual: [reload],
    }[state];

    label.textContent = {
      checking: config.copy.checking,
      failed: config.copy.failed,
      outOfDate: config.copy.outOfDate,
      outOfDateManual: config.copy.outOfDate,
    }[state];

    label.className =
      state === "checking" ? config.labelClassName.checking : config.labelClassName.message;

    tryAgain.hidden = !buttons.includes(tryAgain);
    reload.hidden = !buttons.includes(reload);

    // Reload is the secondary choice next to Try again, and the only one on an out-of-date page.
    reload.className =
      state === "failed" ? config.buttonClassName.secondary : config.buttonClassName.primary;

    if (page.covered) {
      (buttons[0] ?? panel).focus({ preventScroll: true });
    }
  };

  const coverPage = (state: CoverState) => {
    if (!page.covered) {
      page.covered = true;
      page.priorFocus = document.activeElement;
      page.observer ??= new MutationObserver(() => page.covered && repair());

      page.observer.observe(root, {
        attributeFilter: [COVERED],
        attributes: true,
        childList: true,
      });
    }

    repair();
    show(state);
  };

  tryAgain.addEventListener("click", () => {
    show("checking");
    page.retry?.();
  });

  // The learner asked: the guard is written if there's a reset to remember and it can be, and the
  // page reloads either way.
  reload.addEventListener("click", () => {
    if (page.transition) {
      writeGuard(page.transition);
    }

    location.reload();
  });

  // Covered, the page under it never hears a key; Escape doesn't leave the cover either.
  const keepKeys = (event: KeyboardEvent) => {
    if (page.covered) {
      event.stopImmediatePropagation();

      if (event.key === "Escape") {
        event.preventDefault();
      }
    }
  };

  globalThis.addEventListener("keydown", keepKeys, true);
  globalThis.addEventListener("keyup", keepKeys, true);

  globalThis.zoonkIdentityCover = {
    cover: () => coverPage("checking"),
    coverFailed: (retry) => {
      page.retry = retry;
      coverPage("failed");
    },
    reset: (transition) => {
      const decision = parts.decideReset({ state: page.reset, transition });

      page.reset = decision.state;
      page.transition = transition;

      if (decision.automatic && writeGuard(transition)) {
        // The old page stays up until the new one commits: it says so, with nothing to press.
        coverPage("outOfDate");
        location.reload();
        return;
      }

      // Nothing goes on by itself from here: the page waits for the learner to reload it.
      coverPage("outOfDateManual");
    },
    takeHandoff: (onWitness) => {
      const handoff = { seen, witnesses: page.witnesses };

      page.onWitness = onWitness;
      page.witnesses = [];

      return handoff;
    },
    uncover: () => {
      // Only lifting a cover tells the reset guard the page went on. A page with nothing covered
      // yet (its private parts may still be streaming) hasn't shown whether the reload helped, so
      // the guard waits for the first real decision: a reset that repeats it stays manual.
      if (!page.covered) {
        return;
      }

      page.reset = parts.decideReset({ state: page.reset, transition: null }).state;
      page.covered = false;
      page.observer?.disconnect();
      root.removeAttribute(COVERED);
      document.body.inert = false;
      show("checking");

      if (page.priorFocus instanceof HTMLElement && page.priorFocus.isConnected) {
        page.priorFocus.focus({ preventScroll: true });
      }
    },
    witness: (tag) => {
      if (page.onWitness) {
        page.onWitness(tag);
        return;
      }

      page.witnesses.push(tag);

      // Drawn for someone other than the browser's learner (another tag, or nobody), or for a second
      // learner: covered before this boundary paints, and the store decides the reset when it
      // loads. A hint that names nobody yet (absent, legacy, unreadable) doesn't cover a first
      // owner: the page draws, and its returns check.
      const hint = readHint();

      if ((hint !== undefined && hint !== tag) || page.witnesses[0] !== tag) {
        coverPage("outOfDate");
      }
    },
  };
}

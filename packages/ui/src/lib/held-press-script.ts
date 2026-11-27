import {
  HELD_ASK_ATTRIBUTE,
  HELD_PRESS_SELECTOR,
  OPENS_PAGE_ATTRIBUTE,
} from "./held-press-controls";

export const HELD_ATTRIBUTE = "data-held";

type HeldMicrophone = { context: AudioContext; stream: Promise<MediaStream> };

type HeldPresses = {
  /** Called once the root has committed: from then on a node carrying React's props is React's. */
  commit: () => void;
  microphone: HeldMicrophone | null;
};

declare global {
  var zoonkHeldPresses: HeldPresses | undefined;
}

type Held = {
  asks: boolean;
  checked: string | null;
  control: Element | null;
  /** Null for a form React replays itself. */
  deliver: (() => void) | null;
  form: HTMLFormElement | null;
  owners: Element[];
  seen: boolean;
  /** Frames since the press reached the page; -1 while it waits. */
  settled: number;
};

/* oxlint-disable max-lines, max-lines-per-function, max-statements, unicorn/consistent-function-scoping -- Serialized with `toString` to run inline, so all it uses lives in this one function. */

/**
 * Runs inline in the page's `<head>`. A press made before React owns its control is held: the
 * control shows at once that it's on its way, a repeat is swallowed, and the press reaches the
 * control once React owns it. A link pressed then shows it's on its way while the browser follows it. A form whose action is a client function is replayed by React's own
 * script with the values it had at the press; this marks its button and stops a second send.
 * Serialized with `toString`, so it may use only its argument and globals.
 */
function holdPressesBeforeReady({
  ask,
  held,
  opensPage,
  selector,
}: {
  ask: string;
  held: string;
  opensPage: string;
  selector: string;
}) {
  const CONTROLS = `a[href], ${selector}`;

  const TOGGLES = "[role=switch], [role=checkbox], [role=radio], [aria-pressed]";
  const OFF = ':disabled, [aria-disabled="true"]';

  // Slow 3G hydrates in about 40 seconds: a page that hasn't taken the press by twice that never
  // will, and the microphone mustn't stay on for it.
  const MICROPHONE_HOLD_MS = 90_000;

  // A second press this soon on a form that opens a page is a double tap; a later one is a retry of a
  // load the browser stopped.
  const DOUBLE_TAP_MS = 2000;

  // React's form-replay script (react-dom-server) queues a submit only when the form's or its
  // button's action is this, and skips a submit something already prevented.
  // oxlint-disable-next-line no-script-url -- React's own placeholder action, compared, never run.
  const REACT_ACTION = "javascript:throw new Error('React form unexpectedly submitted.')";

  const presses: Held[] = [];
  const heldForms = new Set<HTMLFormElement>();
  const openingForms = new Map<HTMLFormElement, { repeats: boolean; submitter: Element | null }>();
  const addedBusy = new Set<Element>();

  const page = {
    committed: false,
    failSafe: false,
    frame: false,
    lastClick: null as MouseEvent | null,
  };

  const ignore = () => null;

  const propsOf = (node: Element): object | null => {
    const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
    const props: unknown = key ? Reflect.get(node, key) : null;
    return typeof props === "object" ? props : null;
  };

  const reactShowsBusy = (node: Element) => {
    const props = propsOf(node);
    return Boolean(props && Reflect.get(props, "aria-busy"));
  };

  const isReacts = (node: Element) => page.failSafe || (page.committed && propsOf(node) !== null);

  const replayQueue = () =>
    (document as Document & { $$reactFormReplay?: unknown[] }).$$reactFormReplay;

  const isWaiting = (node: Element) =>
    presses.some((press) => press.settled < 0 && press.control === node);

  const stop = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const stateOf = (control: Element) =>
    control.getAttribute("aria-checked") ?? control.getAttribute("aria-pressed");

  /** A toggle shows the state the press asks for, so React taking it over changes nothing on screen. */
  const heldLook = (control: Element) => {
    if (!control.matches(TOGGLES)) {
      return "";
    }

    const turnsOff = stateOf(control) === "true" && !control.matches("[role=radio]");

    return turnsOff ? "unchecked" : "checked";
  };

  const mark = (control: Element) => {
    control.setAttribute(held, heldLook(control));

    if (!control.hasAttribute("aria-busy")) {
      control.setAttribute("aria-busy", "true");
      addedBusy.add(control);
    }
  };

  const unmark = (control: Element | null) => {
    if (!control) {
      return;
    }

    control.removeAttribute(held);

    if (addedBusy.delete(control) && !reactShowsBusy(control)) {
      control.removeAttribute("aria-busy");
    }
  };

  const releaseMicrophone = () => {
    const state = globalThis.zoonkHeldPresses;
    const asked = state?.microphone;

    if (!state || !asked) {
      return;
    }

    state.microphone = null;

    asked.stream.then((stream) => {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }, ignore);

    if (asked.context.state !== "closed") {
      asked.context.close().catch(ignore);
    }
  };

  /** Safari on iOS asks for the microphone only during a tap, and a replayed click isn't one. */
  const askInTap = (control: Element): boolean => {
    const state = globalThis.zoonkHeldPresses;

    if (
      control.getAttribute(ask) !== "microphone" ||
      !state ||
      state.microphone ||
      typeof AudioContext !== "function" ||
      !navigator.mediaDevices
    ) {
      return false;
    }

    const context = new AudioContext();
    context.resume().catch(ignore);
    const stream = navigator.mediaDevices.getUserMedia({ audio: true });
    stream.catch(ignore);
    state.microphone = { context, stream };
    return true;
  };

  /** Built like the press, so the page still tells a tap, a mouse and a screen reader apart. */
  const replayClick = (control: Element, press: MouseEvent | null) => {
    const Click = !press || press instanceof PointerEvent ? PointerEvent : MouseEvent;

    control.dispatchEvent(
      new Click("click", {
        bubbles: true,
        buttons: press?.buttons ?? 0,
        cancelable: true,
        clientX: press?.clientX ?? 0,
        clientY: press?.clientY ?? 0,
        composed: true,
        detail: press?.detail ?? 0,
        pointerType: press instanceof PointerEvent ? press.pointerType : "",
        screenX: press?.screenX ?? 0,
        screenY: press?.screenY ?? 0,
      }),
    );
  };

  // The player keeps earlier cards mounted and hidden, so a press on one of them is dropped.
  const canPress = (node: Element) =>
    node.isConnected &&
    !node.matches(OFF) &&
    (node instanceof HTMLFormElement ||
      (node.checkVisibility?.({ visibilityProperty: true }) ?? true));

  const drop = (press: Held) => {
    unmark(press.control);

    if (press.form) {
      heldForms.delete(press.form);
    }

    if (press.asks) {
      releaseMicrophone();
    }
  };

  /**
   * React hydrates a boundary at once for a click that lands on it mid-render, but a node gets its
   * props key before its boundary commits, so a press waits one more frame after the key shows.
   */
  const deliver = (press: Held, replay: () => void): boolean | null => {
    const target = press.control ?? press.form;

    // A node hydration replaced never becomes React's.
    if (!target || !press.owners.every((owner) => owner.isConnected)) {
      return null;
    }

    if (!press.owners.every((owner) => isReacts(owner))) {
      press.seen = false;
      return false;
    }

    if (!press.seen && !page.failSafe) {
      press.seen = true;
      return false;
    }

    if (!canPress(target)) {
      return null;
    }

    press.settled = 0;

    if (press.form) {
      heldForms.delete(press.form);
    }

    replay();

    // Whatever didn't take the microphone during the replayed press never will.
    if (press.asks) {
      releaseMicrophone();
    }

    return true;
  };

  /** React takes the form out of its queue as it starts the action. */
  const replayedByReact = (press: Held): boolean | null => {
    const { control, form } = press;

    if (!form?.isConnected || (control && !control.isConnected)) {
      return null;
    }

    if (replayQueue()?.includes(form)) {
      return false;
    }

    press.settled = 0;
    heldForms.delete(form);
    return true;
  };

  /** The mark stays until the control shows its own busy or state, so the press never blinks off. */
  const settles = (press: Held) => {
    const { control } = press;
    press.settled += 1;

    return (
      !control?.isConnected ||
      press.settled >= 2 ||
      reactShowsBusy(control) ||
      control.matches(OFF) ||
      stateOf(control) !== press.checked
    );
  };

  /**
   * True once the press is done with. One press reaches the page per frame, so the next one sees
   * what the last one did, such as a button it disabled.
   */
  const advance = (press: Held, frame: { delivered: boolean }): boolean => {
    if (press.settled >= 0) {
      if (settles(press)) {
        unmark(press.control);
        return true;
      }

      return false;
    }

    if (press.deliver === null) {
      const replayed = replayedByReact(press);

      if (replayed === null) {
        drop(press);
      }

      return replayed === null;
    }

    if (frame.delivered) {
      return false;
    }

    const delivered = deliver(press, press.deliver);

    if (delivered === null) {
      drop(press);
      return true;
    }

    frame.delivered = delivered;
    return false;
  };

  const tick = () => {
    if (page.committed && !page.frame && presses.length > 0) {
      page.frame = true;
      requestAnimationFrame(step);
    }
  };

  const step = () => {
    page.frame = false;
    const frame = { delivered: false };
    const left = presses.filter((press) => !advance(press, frame));
    presses.splice(0, presses.length, ...left);
    tick();
  };

  const radioName = (radio: Element) => {
    const input = radio.nextElementSibling;
    const name = input instanceof HTMLInputElement && input.type === "radio" ? input.name : "";
    return radio.getAttribute("name") ?? name;
  };

  const isSameRadioGroup = (radio: Element, other: Element) => {
    const group = radio.closest("[role=radiogroup]");

    if (group) {
      return group === other.closest("[role=radiogroup]");
    }

    const name = radioName(radio);
    const sameForm = radio.closest("form") === other.closest("form");
    return name !== "" && name === radioName(other) && sameForm;
  };

  /** A later pick in the same radio group replaces a waiting one, so only the last is drawn and sent. */
  const replacedPick = (control: Element) => (press: Held) =>
    control.matches("[role=radio]") &&
    press.settled < 0 &&
    press.control !== null &&
    press.control !== control &&
    press.control.matches("[role=radio]") &&
    isSameRadioGroup(control, press.control);

  const discard = (press: Held) => {
    const index = presses.indexOf(press);

    if (index !== -1 && press.settled < 0) {
      presses.splice(index, 1);
      drop(press);
    }
  };

  const hold = (press: Omit<Held, "seen" | "settled">) => {
    const { control } = press;

    if (control) {
      for (const replaced of presses.filter(replacedPick(control))) {
        discard(replaced);
      }

      mark(control);
    }

    const waiting = { ...press, seen: false, settled: -1 };
    presses.push(waiting);

    if (waiting.asks) {
      setTimeout(() => discard(waiting), MICROPHONE_HOLD_MS);
    }

    tick();
  };

  const pressedControl = (event: MouseEvent): Element | null => {
    const { target } = event;

    const isModified =
      event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

    if (isModified || !(target instanceof Element)) {
      return null;
    }

    // A label forwards its tap to the hidden input Base UI keeps beside a switch, checkbox or radio.
    const beside = target.matches("input[aria-hidden=true]") ? target.previousElementSibling : null;
    return target.closest(CONTROLS) ?? (beside?.matches(TOGGLES) ? beside : null);
  };

  /** A link the browser follows in this tab, away from this page. */
  const leavesPage = (link: Element): link is HTMLAnchorElement =>
    link instanceof HTMLAnchorElement &&
    (link.target === "" || link.target === "_self") &&
    !link.hasAttribute("download") &&
    (link.protocol === "https:" || link.protocol === "http:") &&
    !(
      link.hash !== "" &&
      `${link.origin}${link.pathname}${link.search}` ===
        `${location.origin}${location.pathname}${location.search}`
    );

  /**
   * The browser follows a link pressed before React owns it, and the page shows nothing until the
   * next one paints, so the link shows it's on its way. A link the page takes over, as a client-side
   * link does, cancels the click; once React owns the link, a press is its own and clears the mark a
   * stopped load left.
   */
  const pressLink = (event: MouseEvent, link: Element) => {
    if (isReacts(link)) {
      unmark(link);
      return;
    }

    if (leavesPage(link)) {
      setTimeout(() => {
        if (!event.defaultPrevented) {
          mark(link);
        }
      }, 0);
    }
  };

  const isFormSubmitter = (control: Element) =>
    (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) &&
    control.type === "submit" &&
    control.form !== null;

  const runsReactAction = (form: HTMLFormElement, submitter: HTMLElement | null) =>
    (submitter?.getAttribute("formAction") ?? form.action) === REACT_ACTION;

  globalThis.zoonkHeldPresses = {
    commit: () => {
      page.committed = true;
      // Were React to rename its props key, nothing would ever look React's: hold nothing then.
      page.failSafe = propsOf(document.body) === null;
      tick();
    },
    microphone: null,
  };

  globalThis.addEventListener(
    "click",
    (event) => {
      page.lastClick = event;
      const control = pressedControl(event);

      if (!control) {
        return;
      }

      if (control.matches("a[href]")) {
        pressLink(event, control);
        return;
      }

      if (isWaiting(control)) {
        stop(event);
        return;
      }

      // A form's submit button goes on, so the browser checks the form and sends `submit`.
      if (isReacts(control) || isFormSubmitter(control)) {
        return;
      }

      stop(event);

      if (control.matches(OFF)) {
        return;
      }

      hold({
        asks: askInTap(control),
        checked: stateOf(control),
        control,
        deliver: () => replayClick(control, event),
        form: null,
        owners: [control],
      });
    },
    { capture: true },
  );

  globalThis.addEventListener(
    "submit",
    (event) => {
      const form = event.target;

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      const { submitter } = event;

      if (form.hasAttribute(opensPage)) {
        const last = openingForms.get(form);

        if (last?.repeats) {
          stop(event);
          return;
        }

        unmark(last?.submitter ?? null);
        const opening = { repeats: true, submitter };
        openingForms.set(form, opening);

        setTimeout(() => {
          opening.repeats = false;
        }, DOUBLE_TAP_MS);

        if (submitter) {
          mark(submitter);
        }

        return;
      }

      if (heldForms.has(form)) {
        stop(event);
        return;
      }

      if (isReacts(form)) {
        return;
      }

      if (submitter?.matches(OFF)) {
        stop(event);
        return;
      }

      heldForms.add(form);
      const base = { asks: false, checked: null, control: submitter, form };

      if (runsReactAction(form, submitter)) {
        hold({ ...base, deliver: null, owners: [] });
        return;
      }

      // An `onSubmit` form: with no handler yet, the browser would load the form's URL instead.
      stop(event);
      const click = page.lastClick;
      const isTapped = click?.target instanceof Node && Boolean(submitter?.contains(click.target));
      const press = isTapped ? click : null;

      hold({
        ...base,
        deliver: submitter ? () => replayClick(submitter, press) : () => form.requestSubmit(),
        owners: submitter ? [form, submitter] : [form],
      });
    },
    { capture: true },
  );

  // A page restored from the back/forward cache sends nothing it held when the learner left.
  globalThis.addEventListener("pagehide", () => {
    for (const press of presses.splice(0)) {
      drop(press);
    }

    heldForms.clear();
    openingForms.clear();
    replayQueue()?.splice(0);
    releaseMicrophone();
  });

  // The first `pageshow` comes at `load`, when the page a form opens may still be on its way.
  globalThis.addEventListener("pageshow", (event) => {
    if (!event.persisted) {
      return;
    }

    for (const control of document.querySelectorAll(`[${held}]`)) {
      unmark(control);
    }
  });
}

export const HELD_PRESS_SCRIPT = `(${holdPressesBeforeReady.toString()})(${JSON.stringify({ ask: HELD_ASK_ATTRIBUTE, held: HELD_ATTRIBUTE, opensPage: OPENS_PAGE_ATTRIBUTE, selector: HELD_PRESS_SELECTOR })})`;

/** The microphone a held press asked for in its tap, taken once; null when none did. */
export function takeHeldMicrophone(): HeldMicrophone | null {
  const state = globalThis.zoonkHeldPresses;
  const asked = state?.microphone ?? null;

  if (state) {
    state.microphone = null;
  }

  return asked;
}

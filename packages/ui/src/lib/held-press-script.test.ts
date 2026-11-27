import { afterEach, describe, expect, it, vi } from "vitest";
import { HELD_PRESS_SCRIPT } from "./held-press-script";

type Page = Window & typeof globalThis;

// oxlint-disable-next-line no-script-url -- React's own placeholder action, compared, never run.
const REACT_ACTION = "javascript:throw new Error('React form unexpectedly submitted.')";

/** React marks every node it hydrates with its props. */
function own(...nodes: Element[]) {
  for (const node of nodes) {
    Object.assign(node, { __reactProps$test: {} });
  }
}

/** React's inline form-replay listener, as react-dom-server writes it into the page. */
function listenLikeReactsReplayScript(page: Page) {
  page.addEventListener("submit", (event) => {
    const form = event.target as HTMLFormElement;
    const { submitter } = event as SubmitEvent;
    const action = submitter?.getAttribute("formAction") ?? form.action;

    if (event.defaultPrevented || action !== REACT_ACTION) {
      return;
    }

    event.preventDefault();
    const replay = page.document as Document & { $$reactFormReplay?: unknown[] };
    replay.$$reactFormReplay ??= [];
    replay.$$reactFormReplay.push(form, submitter, new page.FormData(form));
  });
}

/** A page of its own for each test, since the script listens on its window for good. */
function openPage(body: string) {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const page = frame.contentWindow as Page;
  const frames: FrameRequestCallback[] = [];
  const reached: MouseEvent[] = [];
  const submits: SubmitEvent[] = [];
  const submitted: SubmitEvent[] = [];

  page.requestAnimationFrame = (callback) => frames.push(callback);
  // Before the script, so it sees every submit the browser would send.
  page.addEventListener("submit", (event) => submits.push(event as SubmitEvent), { capture: true });
  listenLikeReactsReplayScript(page);

  const script = page.document.createElement("script");
  script.textContent = HELD_PRESS_SCRIPT;
  page.document.head.append(script);
  page.document.body.innerHTML = body;

  // React listens at the root, after the script's listener on the window.
  page.document.addEventListener("click", (event) => reached.push(event));

  page.document.addEventListener("submit", (event) => {
    if (event.target instanceof page.HTMLFormElement && "__reactProps$test" in event.target) {
      event.preventDefault();
      submitted.push(event as SubmitEvent);
    }
  });

  const runFrame = () => {
    for (const callback of frames.splice(0)) {
      callback(0);
    }
  };

  return {
    commit: () => {
      own(page.document.body);
      page.zoonkHeldPresses?.commit();
    },
    find: <Found extends Element = HTMLElement>(selector: string) =>
      page.document.querySelector<Found>(selector)!,
    /** Each frame runs what the last one asked for. */
    frame: (count = 1) => {
      Array.from({ length: count }).forEach(() => runFrame());
    },
    leave: () => page.dispatchEvent(new page.Event("pagehide")),
    page,
    press: (target: Element, init: PointerEventInit = {}) =>
      target.dispatchEvent(
        new page.PointerEvent("click", {
          bubbles: true,
          cancelable: true,
          detail: 1,
          pointerType: "touch",
          ...init,
        }),
      ),
    reached,
    replayQueue: () =>
      (page.document as Document & { $$reactFormReplay?: unknown[] }).$$reactFormReplay,
    submits,
    submitted,
  };
}

function fakeMicrophone(page: Page) {
  const track = { stop: vi.fn() };
  const grants: ((stream: { getTracks: () => (typeof track)[] }) => void)[] = [];
  const contexts: { close: ReturnType<typeof vi.fn> }[] = [];

  const getUserMedia = vi.fn(
    () =>
      new Promise((resolve) => {
        grants.push(resolve);
      }),
  );

  class FakeAudioContext {
    state = "suspended";
    close = vi.fn(() => Promise.resolve());
    resume = vi.fn(() => Promise.resolve());

    constructor() {
      contexts.push(this);
    }
  }

  Object.assign(page, { AudioContext: FakeAudioContext });
  Object.defineProperty(page.navigator, "mediaDevices", { value: { getUserMedia } });

  return {
    contexts,
    getUserMedia,
    grant: () => grants.at(-1)?.({ getTracks: () => [track] }),
    track,
  };
}

describe("the keeper of presses made before React owns a control", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("holds a press, shows it at once and presses the control once React has owned it a frame", () => {
    const { commit, find, frame, page, press, reached } = openPage(
      '<button type="button"><span>Create</span></button>',
    );

    const button = find("button");

    expect(press(find("span"))).toBe(false);
    expect(button.dataset.held).toBe("");
    expect(button.getAttribute("aria-busy")).toBe("true");

    commit();
    frame();
    own(button);
    frame();
    expect(reached).toHaveLength(0);

    frame();
    expect(reached).toHaveLength(1);
    expect(reached[0]).toBeInstanceOf(page.PointerEvent);
    expect(reached[0]).toMatchObject({ detail: 1, isTrusted: false, pointerType: "touch" });
    expect("held" in button.dataset).toBe(true);

    frame(2);
    expect("held" in button.dataset).toBe(false);
    expect(button.hasAttribute("aria-busy")).toBe(false);
  });

  it("lets a press through once React owns the control", () => {
    const { commit, find, press, reached } = openPage("<button>Create</button>");

    commit();
    own(find("button"));

    expect(press(find("button"))).toBe(true);
    expect(reached).toHaveLength(1);
    expect("held" in find("button").dataset).toBe(false);
  });

  it("swallows a second press while the first one waits", () => {
    const { commit, find, frame, press, reached } = openPage("<button>Create</button>");

    press(find("button"));
    commit();
    own(find("button"));
    frame();
    expect(press(find("button"))).toBe(false);
    frame(4);

    expect(reached).toHaveLength(1);
  });

  it("leaves links, modified clicks and what isn't a control to the browser", () => {
    const { find, press } = openPage(
      '<a href="#pricing"><span>Pricing</span></a><a href="#log-in" role="button">Log in</a><button>Create</button><p>Text</p>',
    );

    expect(press(find("a span"))).toBe(true);
    expect(press(find("[role=button]"))).toBe(true);
    expect(press(find("button"), { metaKey: true })).toBe(true);
    expect(press(find("p"))).toBe(true);
    expect("held" in find("button").dataset).toBe(false);
  });

  it("drops a press whose control is gone, turned off or hidden by then, and clears its mark", () => {
    const { commit, find, frame, page, press, reached } = openPage(
      '<button id="gone">Create</button><button id="off">Retry</button><button id="hidden">Save</button>',
    );

    const gone = find("#gone");
    const off = find("#off");
    const hidden = find("#hidden");

    for (const button of [gone, off, hidden]) {
      press(button);
    }

    gone.remove();
    off.setAttribute("aria-disabled", "true");
    Object.assign(hidden, { checkVisibility: () => false });
    commit();
    own(off, hidden);
    frame(6);

    expect(reached).toHaveLength(0);
    expect("held" in gone.dataset).toBe(false);
    expect(page.document.querySelectorAll("[data-held], [aria-busy]")).toHaveLength(0);
  });

  it("swallows a press on a control that's off, as React would, without showing it busy", () => {
    const { commit, find, frame, press, reached } = openPage(
      '<button aria-disabled="true">Continue</button>',
    );

    expect(press(find("button"))).toBe(false);
    expect("held" in find("button").dataset).toBe(false);

    commit();
    own(find("button"));
    frame(4);
    expect(reached).toHaveLength(0);
  });

  it("presses one held control per frame, so one the last press turned off is dropped", () => {
    const { commit, find, frame, press, reached } = openPage(
      '<button id="start">Start</button><button id="skip">Skip</button>',
    );

    press(find("#start"));
    press(find("#skip"));
    commit();
    own(find("#start"), find("#skip"));
    frame(2);

    expect(reached.map((event) => (event.target as Element).id)).toStrictEqual(["start"]);

    find("#skip").setAttribute("aria-disabled", "true");
    frame(4);
    expect(reached).toHaveLength(1);
  });

  it("hands the busy look over to the control's own without taking React's away", () => {
    const { commit, find, frame, press, reached } = openPage("<button>Save</button>");
    const button = find("button");

    press(button);
    commit();
    own(button);
    frame(2);
    expect(reached).toHaveLength(1);

    Object.assign(button, { __reactProps$test: { "aria-busy": true } });
    frame();

    expect("held" in button.dataset).toBe(false);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("draws a toggle in the state its press asks for until React shows it", () => {
    const { commit, find, frame, press } = openPage(
      '<span role="switch" aria-checked="true">Use memory</span><span role="radio" aria-checked="false">Weekly</span><button aria-pressed="false">Cooking</button>',
    );

    const toggle = find("[role=switch]");

    press(toggle);
    press(find("[role=radio]"));
    press(find("[aria-pressed]"));
    expect(toggle.dataset.held).toBe("unchecked");
    expect(find("[role=radio]").dataset.held).toBe("checked");
    expect(find("[aria-pressed]").dataset.held).toBe("checked");

    commit();
    own(toggle);
    frame(2);
    toggle.setAttribute("aria-checked", "false");
    frame();

    expect("held" in toggle.dataset).toBe(false);
  });

  it("holds a label's tap that reaches the hidden input Base UI keeps beside a checkbox", () => {
    const { find, press } = openPage(
      '<label><span role="checkbox" aria-checked="false"></span><input aria-hidden="true" type="checkbox">Saturday</label>',
    );

    const input = find<HTMLInputElement>("input");

    expect(press(input)).toBe(false);
    expect(input.checked).toBe(false);
    expect(find("[role=checkbox]").dataset.held).toBe("checked");
  });

  it("lets React's own script replay a client-action form once, with what it held at the press", () => {
    const { commit, find, frame, page, press, replayQueue } = openPage(
      `<form action="${REACT_ACTION}"><textarea name="message">A</textarea><button>Send</button></form>`,
    );

    const send = find("button");

    press(send);
    find<HTMLTextAreaElement>("textarea").value = "B";
    press(send);
    find<HTMLFormElement>("form").requestSubmit();

    expect(send.getAttribute("aria-busy")).toBe("true");
    const sent = replayQueue()?.at(2);
    expect(replayQueue()).toHaveLength(3);
    expect(sent instanceof page.FormData && sent.get("message")).toBe("A");

    commit();
    own(find("form"), send);
    frame();
    expect("held" in send.dataset).toBe(true);

    replayQueue()?.splice(0);
    frame(3);
    expect("held" in send.dataset).toBe(false);
  });

  it("holds an onSubmit form instead of letting the browser load its URL, then presses its button once", () => {
    const { commit, find, frame, press, submits, submitted } = openPage(
      '<form action="/start/goal"><input name="buddy" value="Zu"><button>Continue</button></form>',
    );

    const form = find<HTMLFormElement>("form");
    const continueButton = find("button");

    press(continueButton);
    press(continueButton);

    expect(submits).toHaveLength(1);
    expect(submits[0]?.defaultPrevented).toBe(true);
    expect(continueButton.getAttribute("aria-busy")).toBe("true");

    commit();
    own(continueButton);
    frame(3);
    expect(submitted).toHaveLength(0);

    own(form);
    frame(2);

    expect(submitted).toHaveLength(1);
    expect(submitted[0]?.submitter).toBe(continueButton);
  });

  it("lets the browser send a form that opens a page, once, its button held until a restore shows the page again", () => {
    const { find, leave, page, press } = openPage(
      '<form action="/learn/lesson" data-opens-page method="get"><button name="answer" value="cloud">A cloud</button><button name="answer" value="planet">A planet</button></form>',
    );

    const opened: string[] = [];

    // Last to hear a submit, as the browser is: it loads the form's URL unless something prevented it.
    page.addEventListener("submit", (event) => {
      if (!event.defaultPrevented) {
        opened.push(((event as SubmitEvent).submitter as HTMLButtonElement).value);
      }

      event.preventDefault();
    });

    const cloud = find("[value=cloud]");
    const planet = find("[value=planet]");

    press(cloud);
    press(planet);
    page.dispatchEvent(new page.PageTransitionEvent("pageshow"));

    expect(opened).toStrictEqual(["cloud"]);
    expect(cloud.dataset.held).toBe("");
    expect(cloud.getAttribute("aria-busy")).toBe("true");
    expect("held" in planet.dataset).toBe(false);

    leave();
    page.dispatchEvent(new page.PageTransitionEvent("pageshow", { persisted: true }));
    expect(page.document.querySelectorAll("[data-held], [aria-busy]")).toHaveLength(0);

    press(planet);
    expect(opened).toStrictEqual(["cloud", "planet"]);
  });

  it("replays a submit with no tap as a key press, and one with no button through the form", () => {
    const { commit, find, frame, reached, submitted } = openPage(
      '<form id="named" action="/x"><input name="buddy"><button>Continue</button></form><form id="bare" action="/y"><input name="goal"></form>',
    );

    const named = find<HTMLFormElement>("#named");
    const bare = find<HTMLFormElement>("#bare");

    named.requestSubmit(find<HTMLButtonElement>("#named button"));
    bare.requestSubmit();
    commit();
    own(named, find("#named button"), bare);
    frame(4);

    expect(reached).toHaveLength(1);
    expect(reached[0]).toMatchObject({ detail: 0, pointerType: "" });
    expect(submitted.map((event) => (event.target as Element).id)).toStrictEqual(["named", "bare"]);
  });

  it("sends nothing it held once the learner leaves, so a back/forward restore sends nothing", () => {
    const { commit, find, frame, leave, page, press, reached, replayQueue } = openPage(
      `<button id="create">Create</button><form action="${REACT_ACTION}"><button id="send">Send</button></form>`,
    );

    press(find("#create"));
    press(find("#send"));
    leave();

    expect(replayQueue()).toHaveLength(0);
    expect(page.document.querySelectorAll("[data-held], [aria-busy]")).toHaveLength(0);

    commit();
    own(find("#create"), find("form"), find("#send"));
    frame(4);
    expect(reached.some((event) => (event.target as Element).id === "create")).toBe(false);
  });

  it("stops holding and presses what it held when React's props key is nowhere to be found", () => {
    const { find, frame, page, press, reached } = openPage("<button>Create</button>");

    press(find("button"));
    page.zoonkHeldPresses?.commit();
    frame();
    expect(reached).toHaveLength(1);

    expect(press(find("button"))).toBe(true);
    expect(reached).toHaveLength(2);
  });

  it("asks for the microphone in the tap and hands it to what takes it during the replayed press", () => {
    const { commit, find, frame, page, press } = openPage(
      '<button data-held-ask="microphone">Call Linda</button>',
    );

    const { contexts, getUserMedia, track } = fakeMicrophone(page);
    const taken: unknown[] = [];

    page.document.addEventListener("click", () => {
      const state = page.zoonkHeldPresses!;
      taken.push(state.microphone);
      state.microphone = null;
    });

    press(find("button"));
    press(find("button"));
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: true });

    commit();
    own(find("button"));
    frame(2);

    expect(taken).toHaveLength(1);
    expect(taken[0]).toHaveProperty("context", contexts[0]);
    expect(taken[0]).toHaveProperty("stream");
    expect(contexts[0]?.close).not.toHaveBeenCalled();
    expect(track.stop).not.toHaveBeenCalled();
  });

  it("lets the microphone go when nothing takes it during the replayed press", () => {
    const { commit, find, frame, page, press } = openPage(
      '<button data-held-ask="microphone">Call Linda</button>',
    );

    const { contexts } = fakeMicrophone(page);

    press(find("button"));
    commit();
    own(find("button"));
    frame(2);

    expect(contexts[0]?.close).toHaveBeenCalledOnce();
    expect(page.zoonkHeldPresses?.microphone).toBeNull();
  });

  it("lets the microphone go when its press is dropped, or the learner leaves before allowing it", async () => {
    const { commit, find, frame, leave, page, press } = openPage(
      '<button id="gone" data-held-ask="microphone">Call Linda</button><button id="left" data-held-ask="microphone">Start call</button>',
    );

    const { contexts, grant, track } = fakeMicrophone(page);

    press(find("#gone"));
    find("#gone").remove();
    commit();
    frame();
    expect(contexts[0]?.close).toHaveBeenCalledOnce();

    press(find("#left"));
    leave();
    expect(contexts[1]?.close).toHaveBeenCalledOnce();

    grant();
    await vi.waitFor(() => expect(track.stop).toHaveBeenCalledOnce());
  });

  it("stops a held press before any of the page's own listeners hear it", () => {
    const { find, page, press } = openPage("<button>Create</button>");
    const heard = vi.fn();

    page.addEventListener("click", heard, { capture: true });
    press(find("button"));

    expect(heard).not.toHaveBeenCalled();
  });
});

import { runInThisContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KEEP_TYPING_ATTRIBUTE, KEEP_TYPING_SCRIPT } from "./kept-typing-script";

class TextField {
  value: string;
  readonly key: string | null;

  constructor(value: string, key: string | null) {
    this.value = value;
    this.key = key;
  }

  getAttribute(name: string) {
    return name === KEEP_TYPING_ATTRIBUTE ? this.key : null;
  }
}

type Listener = (event: { target: unknown }) => void;

function openPage() {
  const listeners: { listener: Listener; options: unknown; type: string }[] = [];

  vi.stubGlobal("HTMLInputElement", TextField);
  vi.stubGlobal("HTMLTextAreaElement", TextField);

  vi.stubGlobal("document", {
    addEventListener: (type: string, listener: Listener, options: unknown) => {
      listeners.push({ listener, options, type });
    },
  });

  runInThisContext(KEEP_TYPING_SCRIPT);

  const type = (target: unknown) => {
    listeners.forEach(({ listener }) => listener({ target }));
  };

  return { listeners, type };
}

describe("the keeper of words typed before a field's code arrives", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.zoonkKeptTyping = undefined;
  });

  it("keeps the last words typed into each field that opted in, by its key", () => {
    const { type } = openPage();
    const goal = new TextField("learn", "goal");
    const date = new TextField("2027-06-01", "date");

    type(goal);
    goal.value = "learn to cook";
    type(goal);
    type(date);

    expect(globalThis.zoonkKeptTyping?.typed).toStrictEqual(
      new Map([
        ["goal", "learn to cook"],
        ["date", "2027-06-01"],
      ]),
    );
  });

  it("ignores a field that didn't opt in and anything that isn't a text field", () => {
    const { type } = openPage();

    type(new TextField("search", null));
    type({ getAttribute: () => "goal", value: "not a field" });

    expect(globalThis.zoonkKeptTyping?.typed.size).toBe(0);
  });

  it("stops keeping a field's words once its code took them", () => {
    const { type } = openPage();
    const goal = new TextField("learn", "goal");

    type(goal);
    globalThis.zoonkKeptTyping?.typed.delete("goal");
    globalThis.zoonkKeptTyping?.taken.add("goal");
    goal.value = "learn to cook";
    type(goal);

    expect(globalThis.zoonkKeptTyping?.typed.has("goal")).toBe(false);
  });

  it("listens before the page's own handlers, in the capture phase", () => {
    const { listeners } = openPage();

    expect(listeners).toMatchObject([{ options: { capture: true }, type: "input" }]);
  });
});

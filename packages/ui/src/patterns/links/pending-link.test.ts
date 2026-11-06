import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PENDING_LINK_SCRIPT } from "./pending-link";

/** Whether the click went through: false once something cancelled it. */
function click(target: Element, init: MouseEventInit = {}) {
  const passed = target.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, ...init }),
  );

  vi.runAllTimers();
  return passed;
}

function loginLink() {
  return document.querySelector<HTMLAnchorElement>("a[data-pending-link]")!;
}

describe("the pending-link script", () => {
  beforeAll(() => {
    // The page runs it once, inline in its head.
    const script = document.createElement("script");
    script.textContent = PENDING_LINK_SCRIPT;
    document.head.append(script);
  });

  beforeEach(() => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <a data-pending-link href="#login"><span>Log in</span></a>
      <a href="#pricing">Pricing</a>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks a sign-in link busy and disabled as soon as it's tapped, from any part of it", () => {
    click(loginLink().querySelector("span")!);
    expect(loginLink().getAttribute("aria-busy")).toBe("true");
    expect(loginLink().getAttribute("aria-disabled")).toBe("true");
  });

  it("marks a link whose click the page stops on its way up, as React does while it hydrates", () => {
    loginLink().addEventListener("click", (event) => event.stopPropagation(), { once: true });
    click(loginLink());

    expect(loginLink().getAttribute("aria-busy")).toBe("true");
  });

  it("leaves the page as it is for a new tab or a click the page took over", () => {
    click(loginLink(), { metaKey: true });
    click(loginLink(), { button: 1 });

    loginLink().addEventListener("click", (event) => event.preventDefault(), { once: true });
    click(loginLink());

    click(document.querySelector('a[href="#pricing"]')!);

    expect(document.querySelectorAll("[aria-busy], [aria-disabled]")).toHaveLength(0);
  });

  it("ignores another tap or Enter on a link already on its way, keeping focus", () => {
    loginLink().focus();
    expect(click(loginLink())).toBe(true);

    expect(click(loginLink().querySelector("span")!)).toBe(false);
    expect(click(loginLink(), { metaKey: true })).toBe(true);
    expect(document.activeElement).toBe(loginLink());
  });

  it("clears the mark when going back restores the page", () => {
    click(loginLink());
    globalThis.dispatchEvent(new Event("pageshow"));

    expect(loginLink().hasAttribute("aria-busy")).toBe(false);
    expect(loginLink().hasAttribute("aria-disabled")).toBe(false);
  });
});

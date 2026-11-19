import { LearnProvider } from "@zoonk/learn/provider";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { DroppedCallScreen } from "../../../learn/src/language/conversation/dropped-call-screen";
import { render } from "../_test-utils/render";

const ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: vi.fn() },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  loadCountries: async () => [],
  routes: { buddy: "/buddy", journey: "/plan", signUp: "/login", today: "/", upgrade: "/plus" },
};

function renderDropped(
  dropped: React.ComponentProps<typeof DroppedCallScreen>["dropped"],
  microphoneProblem: React.ComponentProps<typeof DroppedCallScreen>["microphoneProblem"] = null,
) {
  render(
    <LearnProvider adapters={ADAPTERS}>
      <DroppedCallScreen
        dropped={dropped}
        limit={{ period: "day", tier: "plus" }}
        microphoneProblem={microphoneProblem}
        name="Linda"
        onEnd={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
        onTakeover={vi.fn()}
        title="Practice call"
      />
    </LearnProvider>,
  );
}

describe("a call that stopped", () => {
  it.each([
    ["its call time ran out", { reason: "limit", retry: null }, "No more calls today"],
    ["calls are paused", { reason: "callsPaused", retry: null }, "Calls are paused"],
    [
      "it needs a subscription",
      { reason: "plusRequired", retry: null },
      "This call needs a subscription",
    ],
    ["it ended", { reason: "ended", retry: null }, "This call has ended"],
    [
      "another call took over",
      { reason: "callInProgress", retry: "takeover" },
      "You're in another call",
    ],
  ] as const)("is titled by what stopped it when %s", async (_, dropped, title) => {
    renderDropped(dropped);

    await expect.element(page.getByText(title, { exact: true })).toBeVisible();
    await expect.element(page.getByText("The call dropped")).not.toBeInTheDocument();
  });

  it("is titled by the microphone when the browser blocks it", async () => {
    renderDropped({ reason: "microphone", retry: "microphone" }, "blocked");

    await expect.element(page.getByText("Your microphone is off", { exact: true })).toBeVisible();
    await expect.element(page.getByText("The call dropped")).not.toBeInTheDocument();
  });

  it("says it dropped only when the connection was lost", async () => {
    renderDropped({ reason: null, retry: "callAgain" });

    await expect.element(page.getByText("The call dropped")).toBeVisible();
  });

  it("offers no Call again while calls are paused", async () => {
    renderDropped({ reason: "callsPaused", retry: null });

    await expect.element(page.getByRole("button", { name: "End call" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Call again" })).not.toBeInTheDocument();
  });
});

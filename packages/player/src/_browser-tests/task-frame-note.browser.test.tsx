import { LearnProvider } from "@zoonk/learn/provider";
import { TaskFrame } from "@zoonk/learn/task-frame";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "../_test-utils/render";

const LEARN_ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: vi.fn() },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  loadCountries: async () => [],
  routes: { buddy: "/buddy", journey: "/plan", signUp: "/login", today: "/", upgrade: "/plus" },
};

const FAILED = "That didn't go through. Try again in a moment.";

describe("a task's bar note", () => {
  it("still says what went wrong while the task shows no buttons", async () => {
    render(
      <LearnProvider adapters={LEARN_ADAPTERS}>
        <TaskFrame exitHref="/" footer={false} footerNote={<p role="alert">{FAILED}</p>}>
          <p>Writing your speaking part</p>
        </TaskFrame>
      </LearnProvider>,
    );

    await expect.element(page.getByRole("alert")).toHaveTextContent(FAILED);

    await expect.element(page.getByRole("alert")).toBeVisible();
  });
});

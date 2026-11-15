import { LearnProvider } from "@zoonk/learn/provider";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { render } from "../_test-utils/render";
import { TUTOR_ANSWER, stubTutorApi } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { AskTutorEntry, AskTutorScope } from "../questions/ask-tutor";

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

const PHONE = { height: 844, width: 390 };
const WIDE = { height: 900, width: 1440 };
const TARGET = { goalId: crypto.randomUUID(), kind: "subject" as const, subjectKey: "algebra" };
const QUESTION = "Why does the order of operations matter here?";

/** The subject page's two entries: the bar's below 72rem, the side column's row from 72rem. */
function SubjectEntries({ tutor }: { tutor: ReturnType<typeof buildTutor> }) {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <AskTutorScope target={TARGET} tutor={tutor}>
        <div className="contents min-[72rem]:hidden" data-testid="bar">
          <AskTutorEntry size="bar" />
        </div>
        <div className="hidden min-[72rem]:contents" data-testid="row">
          <AskTutorEntry appearance="row" />
        </div>
      </AskTutorScope>
    </LearnProvider>
  );
}

const sheet = () => page.getByRole("dialog");

describe("a screen that places the tutor's entry twice", () => {
  it("opens the one conversation from either entry, whichever was opened first, when a layout change swaps them", async () => {
    stubTutorApi({});
    const tutor = buildTutor();

    await atViewport(WIDE, async () => {
      render(<SubjectEntries tutor={tutor} />);

      // The side column's entry, opened before anything was asked.
      await page.getByTestId("row").getByRole("button").click();
      await expect.element(sheet().getByRole("textbox", { name: "Ask a question" })).toBeVisible();
      await sheet().getByRole("button", { name: "Close questions" }).click();
      await expect.element(sheet()).not.toBeInTheDocument();

      await page.viewport(PHONE.width, PHONE.height);
      await page.getByTestId("bar").getByRole("button").click();
      await sheet().getByRole("textbox", { name: "Ask a question" }).fill(QUESTION);
      await sheet().getByRole("button", { name: "Send" }).click();
      await expect.element(sheet().getByText(TUTOR_ANSWER)).toBeVisible();

      await page.viewport(WIDE.width, WIDE.height);
      await sheet().getByRole("button", { name: "Close questions" }).click();
      await expect.element(sheet()).not.toBeInTheDocument();

      await page.getByTestId("row").getByRole("button").click();
      await expect.element(sheet().getByText(QUESTION)).toBeVisible();
      await expect.element(sheet().getByText(TUTOR_ANSWER)).toBeVisible();
    });
  });

  it("keeps what the learner was typing when a layout change swaps the entry", async () => {
    stubTutorApi({});
    const tutor = buildTutor();

    await atViewport(PHONE, async () => {
      render(<SubjectEntries tutor={tutor} />);

      await page.getByTestId("bar").getByRole("button").click();
      await sheet().getByRole("textbox", { name: "Ask a question" }).fill(QUESTION);
      await sheet().getByRole("button", { name: "Close questions" }).click();
      await expect.element(sheet()).not.toBeInTheDocument();

      await page.viewport(WIDE.width, WIDE.height);
      await page.getByTestId("row").getByRole("button").click();

      await expect
        .element(sheet().getByRole("textbox", { name: "Ask a question" }))
        .toHaveValue(QUESTION);
    });
  });
});

import { safeAsync } from "@zoonk/utils/error";
import { type ComponentProps, useTransition } from "react";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { RoleStep } from "../../../learn/src/onboarding/steps/role-step";
import { BasesAdvice, useBasesAdvice } from "../../../learn/src/plan/plan-bases-advice";
import { PlanScreenContext } from "../../../learn/src/plan/plan-context";
import { TodayAction, TodayContinueProvider } from "../../../learn/src/today/today-action";
import { TodayScreenProvider } from "../../../learn/src/today/today-context";
import { TodayUpNext } from "../../../learn/src/today/today-up-next";
import { render } from "../_test-utils/render";

function RoleStepSaving({ save }: { save: () => Promise<unknown> }) {
  const [pending, startTransition] = useTransition();

  const answer = () =>
    startTransition(async () => {
      await safeAsync(save);
    });

  return <RoleStep onAnswer={answer} pending={pending} purpose="work" />;
}

function Advice() {
  const advice = useBasesAdvice();
  return <BasesAdvice ask={() => void advice.ask()} followed={false} state={advice.state} />;
}

function box(element: Element) {
  const { width, x, y } = element.getBoundingClientRect();
  return { width, x, y };
}

describe("only the control that sent a request spins", () => {
  it("spins Skip, not Continue, while an onboarding step's skip saves", async () => {
    const saved = Promise.withResolvers<null>();
    render(<RoleStepSaving save={() => saved.promise} />);

    await page.getByRole("textbox", { name: "Your role" }).fill("Nurse");
    const skip = page.getByRole("button", { exact: true, name: "Skip" });
    const next = page.getByRole("button", { name: /^Continue/u });
    await skip.click();

    await expect.element(skip).toHaveAttribute("aria-busy", "true");
    await expect.element(skip).toHaveFocus();
    await expect.element(next).not.toHaveAttribute("aria-busy");
    await expect.element(next).toHaveAttribute("aria-disabled", "true");

    saved.resolve(null);
    await expect.element(skip).not.toHaveAttribute("aria-busy");
  });

  it("keeps Try again, its width and its place while a failed recommendation is asked again", async () => {
    const retried = Promise.withResolvers<null>();
    const adviseOnBases = vi.fn().mockResolvedValueOnce(null).mockReturnValueOnce(retried.promise);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the advice reads only these.
    const plan = {
      actions: { adviseOnBases },
      goal: { kind: "learn", title: "Physics" },
    } as unknown as ComponentProps<typeof PlanScreenContext>["value"];

    render(
      <PlanScreenContext value={plan}>
        <Advice />
      </PlanScreenContext>,
    );

    await page.getByRole("button", { name: "Get a recommendation" }).click();
    const retry = page.getByRole("button", { name: "Try again" });
    await expect.element(retry).toBeVisible();
    const before = box(retry.element());

    await retry.click();
    await expect.element(retry).toHaveAttribute("aria-busy", "true");
    expect(box(retry.element())).toStrictEqual(before);
    await expect.element(page.getByText("We couldn't get a recommendation.")).toBeVisible();

    retried.resolve(null);
    await expect.element(retry).not.toHaveAttribute("aria-busy");
  });

  it("spins only the up-next row or Keep learning, whichever was pressed", async () => {
    const opens = [Promise.withResolvers<boolean>(), Promise.withResolvers<boolean>()];

    const addExtraTime = vi
      .fn()
      .mockReturnValueOnce(opens[0]!.promise)
      .mockReturnValueOnce(opens[1]!.promise);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the up-next list and its action read only these.
    const today = {
      actions: { addExtraTime, continueHref: null, continueSession: vi.fn() },
      today: {
        progress: null,
        session: {
          extraTime: { available: true, lessons: [{ minutes: 5, title: "Ratios" }], minutes: 5 },
          state: "done",
        },
      },
    } as unknown as ComponentProps<typeof TodayScreenProvider>["value"];

    render(
      <TodayScreenProvider value={today}>
        <TodayContinueProvider>
          <TodayAction />
          <TodayUpNext />
        </TodayContinueProvider>
      </TodayScreenProvider>,
    );

    const row = page.getByRole("button", { name: "Ratios" });
    const keepLearning = page.getByRole("button", { name: /^Keep learning/u });

    await row.click();
    await expect.element(row).toHaveAttribute("aria-busy", "true");
    await expect.element(keepLearning).not.toHaveAttribute("aria-busy");
    await expect.element(keepLearning).toHaveAttribute("aria-disabled", "true");

    opens[0]!.resolve(false);
    await expect.element(row).not.toHaveAttribute("aria-busy");

    await keepLearning.click();
    await expect.element(keepLearning).toHaveAttribute("aria-busy", "true");
    await expect.element(row).not.toHaveAttribute("aria-busy");
    await expect.element(row).toHaveAttribute("aria-disabled", "true");

    opens[1]!.resolve(false);
    await expect.element(keepLearning).not.toHaveAttribute("aria-busy");
  });
});

import { safeAsync } from "@zoonk/utils/error";
import { type ComponentProps, useTransition } from "react";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { RoleStep } from "../../../learn/src/onboarding/steps/role-step";
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
          extraTime: {
            available: true,
            lessons: [
              { minutes: 5, title: "Ratios" },
              { minutes: 5, title: "Proportions" },
            ],
            minutes: 5,
          },
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
    const rowOpacity = () => Number(getComputedStyle(row.element().closest("li")!).opacity);
    const resting = rowOpacity();
    const later = page.getByText("Proportions");
    const laterOpacity = () => Number(getComputedStyle(later.element().closest("li")!).opacity);
    const laterResting = laterOpacity();

    await row.click();
    await expect.element(row).toHaveAttribute("aria-busy", "true");
    expect(rowOpacity()).toBe(resting);
    await expect.element(keepLearning).not.toHaveAttribute("aria-busy");
    await expect.element(keepLearning).toHaveAttribute("aria-disabled", "true");

    opens[0]!.resolve(false);
    await expect.element(row).not.toHaveAttribute("aria-busy");

    await keepLearning.click();
    await expect.element(keepLearning).toHaveAttribute("aria-busy", "true");
    await expect.element(row).not.toHaveAttribute("aria-busy");
    await expect.element(row).toHaveAttribute("aria-disabled", "true");
    await expect.poll(rowOpacity).toBeLessThan(resting);
    expect(laterOpacity()).toBe(laterResting);

    opens[1]!.resolve(false);
    await expect.element(keepLearning).not.toHaveAttribute("aria-busy");
  });
});

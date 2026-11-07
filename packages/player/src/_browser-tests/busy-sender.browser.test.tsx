import { safeAsync } from "@zoonk/utils/error";
import { useTransition } from "react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { RoleStep } from "../../../learn/src/onboarding/steps/role-step";
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
});

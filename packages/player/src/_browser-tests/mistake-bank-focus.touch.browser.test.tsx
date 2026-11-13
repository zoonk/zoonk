import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { bankQuestion, openPractice } from "../_test-utils/mistake-practice";

describe("bank mistake inputs on touch screens", () => {
  it.each(["numeric", "typed"] as const)(
    "opens the %s question at its heading until the learner taps the field",
    async (kind) => {
      openPractice(null, {}, bankQuestion(kind));
      const field = page.getByRole("textbox");
      await expect.element(field).not.toHaveFocus();

      await expect
        .element(page.getByRole("heading", { name: "Practice mistakes" }))
        .toBeInViewport();

      await expect.element(page.getByRole("link", { name: "Leave" })).toBeInViewport();

      expect(window.scrollY).toBe(0);
      await field.click();
      await expect.element(field).toHaveFocus();
    },
  );
});

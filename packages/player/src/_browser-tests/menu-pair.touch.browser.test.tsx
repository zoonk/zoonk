import { TaskHeaderMenu } from "@zoonk/learn/task-header";
import { Drawer, DrawerContent, DrawerPopup, DrawerTitle } from "@zoonk/ui/components/drawer";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { render } from "../_test-utils/render";
import { tap } from "../_test-utils/touch-screen";

function ReviewEntry({ question }: { question: string }) {
  return (
    <li>
      {question}
      <TaskHeaderMenu label={`${question} options`}>
        <DropdownMenuItem>Report {question}</DropdownMenuItem>
      </TaskHeaderMenu>
    </li>
  );
}

/** A mock result's "See answers": each entry has its own "…". */
function ReviewEntries() {
  return (
    <Drawer defaultOpen>
      <DrawerPopup>
        <DrawerTitle>Questions to review</DrawerTitle>
        <DrawerContent>
          <ol>
            <ReviewEntry question="Question 1" />
            <ReviewEntry question="Question 2" />
          </ol>
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}

describe("two entries' menus on a touch screen", () => {
  it("keeps focus in the second menu when it's opened over the first", async () => {
    render(<ReviewEntries />);

    await tap(page.getByRole("button", { name: "Question 1 options" }));
    await expect.element(page.getByRole("menuitem", { name: "Report Question 1" })).toBeVisible();

    await tap(page.getByRole("button", { name: "Question 2 options" }));

    await expect
      .element(page.getByRole("menuitem", { name: "Report Question 1" }))
      .not.toBeInTheDocument();

    await expect.element(page.getByRole("menu")).toHaveFocus();
    await expect.element(page.getByRole("menuitem", { name: "Report Question 2" })).toBeVisible();

    await press("Escape");
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Question 2 options" })).toHaveFocus();
  });
});

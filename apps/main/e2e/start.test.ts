import { type Page, expect, test } from "./fixtures";

/** The old start pages without a goal in them: each opens onboarding with an empty goal box. */
const EMPTY_START_PATHS = ["/start/learn", "/start/speak", "/start/speak/jv", "/start/exam"];

async function expectEmptyStart(page: Page, path: string) {
  await page.goto(path);

  await expect(page).toHaveURL(/\/start$/u);
  await expect(page.getByRole("textbox", { name: "Your goal" })).toHaveValue("");
}

test("old start pages open onboarding, with a course prompt's goal filled in its language", async ({
  page,
}) => {
  await page.goto(`/start/learn/${encodeURIComponent("Python 3.12")}`);

  await expect(page).toHaveURL(/\/start\?goal=Python(?:%20|\+)3\.12$/u);
  await expect(page.getByRole("textbox", { name: "Your goal" })).toHaveValue("Python 3.12");

  for (const path of EMPTY_START_PATHS) {
    // oxlint-disable-next-line no-await-in-loop -- One page visits each old path in turn.
    await expectEmptyStart(page, path);
  }

  // Last, so the language it keeps doesn't carry over to the English paths.
  await page.goto("/pt/start/learn/Fotografia");

  await expect(page).toHaveURL(/\/pt\/start\?goal=Fotografia$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt");
});

import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "./fixtures";

function getModifierKey(): "Meta" | "Control" {
  return process.platform === "darwin" ? "Meta" : "Control";
}

async function openCommandPalette(page: Page) {
  await page.getByRole("button", { name: /search/i }).click();
}

async function fillCourseForm(
  page: Page,
  {
    title,
    description,
    slug,
  }: {
    title: string;
    description: string;
    slug: string;
  },
) {
  // Step 1: Title
  await page.getByPlaceholder(/course title/i).fill(title);
  await page.keyboard.press("Enter");

  // Step 2: Language - use default
  await page.keyboard.press("Enter");

  // Step 3: Description
  await page.getByPlaceholder(/brief description/i).fill(description);
  await page.keyboard.press("Enter");

  // Step 4: Slug
  await page.getByPlaceholder(/course-title/i).fill(slug);
}

function getProgressBar(page: Page) {
  return page.getByRole("progressbar");
}

test.describe("Course Creation Wizard - Navigation & Entry Points", () => {
  test("navigates directly to wizard", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai/new-course");

    await expect(authenticatedPage.getByText(/course title/i).first()).toBeVisible();

    await expect(getProgressBar(authenticatedPage)).toHaveAttribute("aria-valuenow", "1");
  });

  test("enters from org home header button", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai");
    await authenticatedPage.getByRole("link", { name: /create course/i }).click();

    await expect(authenticatedPage).toHaveURL(/\/ai\/new-course/);
    await expect(authenticatedPage.getByText(/course title/i).first()).toBeVisible();
  });

  test("enters from command palette", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai");
    await openCommandPalette(authenticatedPage);

    await authenticatedPage
      .getByRole("dialog")
      .getByText(/create course/i)
      .click();

    await expect(authenticatedPage).toHaveURL(/\/ai\/new-course/);
    await expect(authenticatedPage.getByText(/course title/i).first()).toBeVisible();
  });
});

test.describe("Course Creation Wizard - Step Navigation", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai/new-course");
    await expect(authenticatedPage.getByText(/course title/i).first()).toBeVisible();
  });

  test("shows title step on initial load", async ({ authenticatedPage }) => {
    await expect(authenticatedPage.getByPlaceholder(/course title/i)).toBeVisible();

    await expect(getProgressBar(authenticatedPage)).toHaveAttribute("aria-label", "Step 1 of 4");
  });

  test("progress dots update as steps advance", async ({ authenticatedPage }) => {
    const progressBar = getProgressBar(authenticatedPage);

    await expect(progressBar).toHaveAttribute("aria-valuenow", "1");

    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");
    await authenticatedPage.getByRole("button", { name: /next/i }).click();

    await expect(progressBar).toHaveAttribute("aria-valuenow", "2");
    await expect(progressBar).toHaveAttribute("aria-label", "Step 2 of 4");
  });

  test("next button advances when step is valid", async ({ authenticatedPage }) => {
    await authenticatedPage.getByPlaceholder(/course title/i).fill("My Course");

    await expect(authenticatedPage.getByRole("button", { name: /next/i })).toBeEnabled();

    await authenticatedPage.getByRole("button", { name: /next/i }).click();

    await expect(authenticatedPage.getByText(/course language/i)).toBeVisible();
  });

  test("next button disabled when step is invalid", async ({ authenticatedPage }) => {
    await expect(authenticatedPage.getByPlaceholder(/course title/i)).toHaveValue("");

    await expect(authenticatedPage.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  test("back button navigates to previous step", async ({ authenticatedPage }) => {
    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");
    await authenticatedPage.getByRole("button", { name: /next/i }).click();

    await expect(authenticatedPage.getByText(/course language/i)).toBeVisible();

    await authenticatedPage.getByRole("button", { name: /back/i }).click();

    await expect(authenticatedPage.getByPlaceholder(/course title/i)).toBeVisible();
  });

  test("back button disabled on first step", async ({ authenticatedPage }) => {
    await expect(authenticatedPage.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  test("shows Create button on last step", async ({ authenticatedPage }) => {
    await fillCourseForm(authenticatedPage, {
      description: "Test description",
      slug: `unique-slug-${randomUUID()}`,
      title: "Test Course",
    });

    await expect(authenticatedPage.getByRole("button", { name: /create/i })).toBeVisible();

    await expect(authenticatedPage.getByRole("button", { name: /next/i })).not.toBeVisible();
  });
});

test.describe("Course Creation Wizard - Keyboard Shortcuts", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai/new-course");

    await expect(authenticatedPage.getByText(/course title/i).first()).toBeVisible();
  });

  test("Escape closes wizard and returns to org home", async ({ authenticatedPage }) => {
    await authenticatedPage.keyboard.press("Escape");

    await expect(authenticatedPage).toHaveURL(/\/ai$/);

    await expect(authenticatedPage.getByRole("heading", { name: /draft courses/i })).toBeVisible();
  });

  test("ArrowRight navigates forward when valid", async ({ authenticatedPage }) => {
    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");

    await authenticatedPage.getByPlaceholder(/course title/i).blur();
    await authenticatedPage.keyboard.press("ArrowRight");

    await expect(authenticatedPage.getByText(/course language/i)).toBeVisible();
  });

  test("ArrowRight does nothing when step is invalid", async ({ authenticatedPage }) => {
    await authenticatedPage.getByPlaceholder(/course title/i).blur();
    await authenticatedPage.keyboard.press("ArrowRight");

    await expect(authenticatedPage.getByPlaceholder(/course title/i)).toBeVisible();
  });

  test("ArrowLeft navigates back", async ({ authenticatedPage }) => {
    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");
    await authenticatedPage.keyboard.press("Enter");

    await expect(authenticatedPage.getByText(/course language/i)).toBeVisible();

    await authenticatedPage.keyboard.press("ArrowLeft");

    await expect(authenticatedPage.getByPlaceholder(/course title/i)).toBeVisible();
  });

  test("ArrowLeft does nothing on first step", async ({ authenticatedPage }) => {
    await authenticatedPage.keyboard.press("ArrowLeft");

    await expect(authenticatedPage.getByPlaceholder(/course title/i)).toBeVisible();
  });

  test("Enter advances to next step", async ({ authenticatedPage }) => {
    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");

    await authenticatedPage.keyboard.press("Enter");

    await expect(authenticatedPage.getByText(/course language/i)).toBeVisible();
  });

  test("keyboard navigation ignores modifier keys", async ({ authenticatedPage }) => {
    const modifier = getModifierKey();

    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");

    await authenticatedPage.getByPlaceholder(/course title/i).blur();

    await authenticatedPage.keyboard.press(`${modifier}+ArrowRight`);

    await expect(authenticatedPage.getByPlaceholder(/course title/i)).toBeVisible();
  });
});

test.describe("Course Creation Wizard - Form Validation", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai/new-course");
  });

  test("title step requires non-empty title", async ({ authenticatedPage }) => {
    await expect(authenticatedPage.getByRole("button", { name: /next/i })).toBeDisabled();

    await authenticatedPage.getByPlaceholder(/course title/i).fill("   ");
    await expect(authenticatedPage.getByRole("button", { name: /next/i })).toBeDisabled();

    await authenticatedPage.getByPlaceholder(/course title/i).fill("Valid Title");
    await expect(authenticatedPage.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  test("language step proceeds with default selection", async ({ authenticatedPage }) => {
    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");
    await authenticatedPage.keyboard.press("Enter");

    await expect(authenticatedPage.getByText(/course language/i)).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  test("language step allows clicking to change selection", async ({ authenticatedPage }) => {
    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");
    await authenticatedPage.keyboard.press("Enter");

    await expect(authenticatedPage.getByText(/course language/i)).toBeVisible();

    const englishRadio = authenticatedPage.getByRole("radio", {
      name: /english/i,
    });
    const portugueseRadio = authenticatedPage.getByRole("radio", {
      name: /portugu[eê]s/i,
    });

    await expect(englishRadio).toBeChecked();
    await expect(portugueseRadio).not.toBeChecked();

    // Click Portuguese radio to change selection
    await portugueseRadio.click();

    await expect(portugueseRadio).toBeChecked();
    await expect(englishRadio).not.toBeChecked();

    // Click English radio to change back
    await englishRadio.click();

    await expect(englishRadio).toBeChecked();
    await expect(portugueseRadio).not.toBeChecked();
  });

  test("description step requires non-empty description", async ({ authenticatedPage }) => {
    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");

    await authenticatedPage.keyboard.press("Enter");
    await authenticatedPage.keyboard.press("Enter");

    await expect(authenticatedPage.getByText(/course description/i)).toBeVisible();

    await expect(authenticatedPage.getByRole("button", { name: /next/i })).toBeDisabled();

    await authenticatedPage.getByPlaceholder(/brief description/i).fill("   ");
    await expect(authenticatedPage.getByRole("button", { name: /next/i })).toBeDisabled();

    await authenticatedPage.getByPlaceholder(/brief description/i).fill("A valid description");
    await expect(authenticatedPage.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  test("slug step shows error for existing slug", async ({ authenticatedPage }) => {
    await fillCourseForm(authenticatedPage, {
      description: "Test description",
      slug: "machine-learning",
      title: "Test Course",
    });

    await expect(
      authenticatedPage.getByText(/a course with this url already exists/i),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("button", { name: /create/i })).toBeDisabled();
  });

  test("slug step allows unique slug", async ({ authenticatedPage }) => {
    const uniqueSlug = `unique-slug-${randomUUID()}`;

    await fillCourseForm(authenticatedPage, {
      description: "Test description",
      slug: uniqueSlug,
      title: "Test Course",
    });

    await expect(authenticatedPage.getByRole("button", { name: /create/i })).toBeEnabled();

    await expect(
      authenticatedPage.getByText(/a course with this url already exists/i),
    ).not.toBeVisible();
  });

  test("slug step cannot submit with empty slug", async ({ authenticatedPage }) => {
    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");

    await authenticatedPage.keyboard.press("Enter");
    await authenticatedPage.keyboard.press("Enter");

    await authenticatedPage.getByPlaceholder(/brief description/i).fill("Description");

    await authenticatedPage.keyboard.press("Enter");

    await authenticatedPage.getByPlaceholder(/course-title/i).clear();

    await expect(authenticatedPage.getByRole("button", { name: /create/i })).toBeDisabled();
  });
});

test.describe("Course Creation Wizard - Successful Creation", () => {
  test("creates course and redirects to course page", async ({ authenticatedPage }) => {
    const uniqueSlug = `e2e-test-${randomUUID()}`;
    const courseTitle = "E2E Test Course";
    const courseDescription = "A course created during E2E testing";

    await authenticatedPage.goto("/ai/new-course");

    await fillCourseForm(authenticatedPage, {
      description: courseDescription,
      slug: uniqueSlug,
      title: courseTitle,
    });

    // Wait for debounced slug validation to complete by asserting button is enabled
    const createButton = authenticatedPage.getByRole("button", {
      name: /create/i,
    });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // Verify destination page shows the created course content
    const titleInput = authenticatedPage.getByRole("textbox", {
      name: /edit course title/i,
    });
    const descriptionInput = authenticatedPage.getByRole("textbox", {
      name: /edit course description/i,
    });

    await expect(titleInput).toHaveValue(courseTitle);
    await expect(descriptionInput).toHaveValue(courseDescription);
  });

  test("auto-fills slug from title", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai/new-course");

    await authenticatedPage.getByPlaceholder(/course title/i).fill("My Amazing Course");

    await authenticatedPage.keyboard.press("Enter");
    await authenticatedPage.keyboard.press("Enter");

    await authenticatedPage.getByPlaceholder(/brief description/i).fill("Description");

    await authenticatedPage.keyboard.press("Enter");

    await expect(authenticatedPage.getByPlaceholder(/course-title/i)).toHaveValue(
      "my-amazing-course",
    );
  });
});

test.describe("Course Creation Wizard - Close Button", () => {
  test("close button returns to org home", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai/new-course");

    await authenticatedPage.getByRole("link", { name: /close/i }).click();

    await expect(authenticatedPage).toHaveURL(/\/ai$/);
  });
});

test.describe("Course Creation Wizard - Permissions", () => {
  test("owner can access wizard", async ({ ownerPage }) => {
    await ownerPage.goto("/ai/new-course");

    await expect(ownerPage.getByText(/course title/i).first()).toBeVisible();
  });

  test("member cannot access wizard", async ({ memberPage }) => {
    await memberPage.goto("/ai/new-course");

    await expect(memberPage.getByText(/unauthorized/i)).toBeVisible();
  });

  test("non-org member cannot access wizard", async ({ userWithoutOrg }) => {
    await userWithoutOrg.goto("/ai/new-course");

    await expect(userWithoutOrg.getByText(/unauthorized/i)).toBeVisible();
  });

  test("unauthenticated user cannot access wizard", async ({ page }) => {
    await page.goto("/ai/new-course");

    await expect(page.getByText(/unauthorized/i)).toBeVisible();
  });
});

test.describe("Course Creation Wizard - Input Auto-focus", () => {
  test("title input is auto-focused on load", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai/new-course");

    await expect(authenticatedPage.getByPlaceholder(/course title/i)).toBeFocused();
  });

  test("description textarea is auto-focused on step", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai/new-course");

    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");
    await authenticatedPage.keyboard.press("Enter");
    await authenticatedPage.keyboard.press("Enter");

    await expect(authenticatedPage.getByPlaceholder(/brief description/i)).toBeFocused();
  });

  test("slug input is auto-focused on step", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai/new-course");

    await authenticatedPage.getByPlaceholder(/course title/i).fill("Test Course");

    await authenticatedPage.keyboard.press("Enter");
    await authenticatedPage.keyboard.press("Enter");

    await authenticatedPage.getByPlaceholder(/brief description/i).fill("Description");

    await authenticatedPage.keyboard.press("Enter");

    await expect(authenticatedPage.getByPlaceholder(/course-title/i)).toBeFocused();
  });
});

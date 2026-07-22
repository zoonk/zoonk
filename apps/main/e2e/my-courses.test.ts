import { expect, test } from "./fixtures";

test.describe("My Courses", () => {
  test("signed-out learners are prompted to log in to track their courses", async ({ page }) => {
    await page.goto("/my");

    await expect(page.getByRole("heading", { name: /my courses/iu })).toBeVisible();
    await expect(page.getByText(/log in to track your courses/iu)).toBeVisible();

    await expect(
      page.getByText(/keep your courses and progress in one place by logging in to your account/iu),
    ).toBeVisible();

    const loginLink = page.getByRole("link", { name: /log in/iu });

    await expect(loginLink).toHaveAttribute("href", "/login?next=%2Fmy");
    await expect(page.getByText(/no courses yet/iu)).toHaveCount(0);
  });

  test("empty state starts a course from the start page", async ({ userWithoutProgress }) => {
    await userWithoutProgress.goto("/my");

    await expect(userWithoutProgress.getByRole("heading", { name: /my courses/iu })).toBeVisible();
    await expect(userWithoutProgress.getByText(/no courses yet/iu)).toBeVisible();

    const startCourseLink = userWithoutProgress.getByRole("link", { name: /start a course/iu });

    await expect(userWithoutProgress.getByRole("link", { name: /explore courses/iu })).toHaveCount(
      0,
    );

    await expect(startCourseLink).toHaveAttribute("href", "/start");

    await startCourseLink.click();

    await expect(userWithoutProgress).toHaveURL(/\/start$/u);

    await expect(
      userWithoutProgress.getByRole("heading", { name: "What's your goal?" }),
    ).toBeVisible();
  });
});

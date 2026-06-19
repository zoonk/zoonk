import { expect, test } from "./fixtures";

test.describe("My Courses", () => {
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

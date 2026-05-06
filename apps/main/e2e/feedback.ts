import { type Page } from "@playwright/test";

type FeedbackSubmissionMock = { requestBody: Promise<unknown> };

/**
 * Replaces the public feedback API with a local success response so feedback
 * UI tests prove the browser sends the expected payload without consuming
 * mailer quota or depending on the API app being available during main e2e.
 */
export async function mockFeedbackSubmission(page: Page): Promise<FeedbackSubmissionMock> {
  await page.route("**/v1/feedback", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { message: "Feedback received" },
      status: 200,
    });
  });

  return {
    requestBody: page.waitForRequest("**/v1/feedback").then((request) => {
      const requestBody: unknown = request.postDataJSON();

      return requestBody;
    }),
  };
}

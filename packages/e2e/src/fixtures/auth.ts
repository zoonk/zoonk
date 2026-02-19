import { test as baseTest } from "@playwright/test";

export type { Page, Route } from "@playwright/test";
export { expect, request } from "@playwright/test";

export const test = baseTest.extend({
  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  baseURL: async ({}, use) => {
    const url = process.env.E2E_BASE_URL;

    if (!url) {
      throw new Error("E2E_BASE_URL not set. Is the webServer running?");
    }

    await use(url);
  },
});

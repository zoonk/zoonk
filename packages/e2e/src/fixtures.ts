import { test as baseTest } from "@playwright/test";
import { getBaseURL } from "./fixtures/base-url";

export { expect } from "@playwright/test";

export const test = baseTest.extend({
  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  baseURL: async ({}, use) => {
    await use(getBaseURL());
  },
});

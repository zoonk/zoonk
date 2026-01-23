import { type AuthFixtures, test as base, createStorageStateFixtures } from "@zoonk/e2e/fixtures";

export const test = base.extend<AuthFixtures>(
  createStorageStateFixtures({
    authDir: "e2e/.auth",
    files: {
      authenticatedPage: "withProgress.json",
      logoutPage: "logout.json",
      userWithoutProgress: "noProgress.json",
    },
  }),
);

export { expect, type Page } from "@zoonk/e2e/fixtures";

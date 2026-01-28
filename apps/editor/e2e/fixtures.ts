import { type Page, test as base, createAuthFixture } from "@zoonk/e2e/fixtures";

type EditorAuthFixtures = {
  authenticatedPage: Page;
  memberPage: Page;
  multiOrgPage: Page;
  ownerPage: Page;
  userWithoutOrg: Page;
};

export const test = base.extend<EditorAuthFixtures>({
  authenticatedPage: createAuthFixture("e2e/.auth/admin.json"),
  memberPage: createAuthFixture("e2e/.auth/member.json"),
  multiOrgPage: createAuthFixture("e2e/.auth/multiOrg.json"),
  ownerPage: createAuthFixture("e2e/.auth/owner.json"),
  userWithoutOrg: createAuthFixture("e2e/.auth/noOrg.json"),
});

export { expect, type Page } from "@zoonk/e2e/fixtures";

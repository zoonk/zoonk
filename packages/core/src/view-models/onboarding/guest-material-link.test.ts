import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { linkGuestAccount } from "../../../../auth/src/guests/link-guest-account";
import { mergeIntoSharedCopy, uploadWithSharedCopyFixture } from "../../_test-utils/merged-upload";
import { mockSession } from "../../_test-utils/mock-session";
import { getOnboardingDraft } from "./get-onboarding-draft";

describe("a guest's material when they sign up", () => {
  it("keeps the card's material: an upload the account found through research, and one merged into a shared copy", async () => {
    const [account, guest] = await Promise.all([userFixture(), userFixture()]);
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });

    const [researched, accountGoal, { shared, upload }] = await Promise.all([
      sourceFixture({ extractedText: "Cell biology syllabus", title: "Syllabus" }),
      goalFixture({ userId: account.id }),
      uploadWithSharedCopyFixture(guest.id),
    ]);

    await Promise.all([
      learnerSourceFixture({ sourceId: researched.id, userId: guest.id }),
      learnerSourceFixture({
        goalId: accountGoal.id,
        origin: "research",
        sourceId: researched.id,
        userId: account.id,
      }),
    ]);

    await mergeIntoSharedCopy(upload);

    const draft = await onboardingDraftFixture({
      materialIntent: "exam",
      sourceIds: [researched.id, upload.id],
      userId: guest.id,
    });

    await linkGuestAccount({ account: { id: account.id }, guestUserId: guest.id });
    mockSession(account.id);

    await expect(getOnboardingDraft({ draftId: draft.id })).resolves.toMatchObject({
      draft: { materialMissing: false, sources: [{ id: researched.id }, { id: shared.id }] },
    });
  });
});

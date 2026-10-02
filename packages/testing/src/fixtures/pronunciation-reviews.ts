import { type PronunciationReview, prisma } from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

/** A word a learner mispronounced, due now unless `dueAt` says otherwise. */
export async function pronunciationReviewFixture(
  attrs: FixtureAttrs<PronunciationReview> & Pick<PronunciationReview, "userId" | "wordId">,
) {
  return prisma.pronunciationReview.create({
    data: { dueAt: new Date(), language: "en", userLanguage: "pt", ...attrs },
  });
}

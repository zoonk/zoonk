import { type ContentFeedback, type Feedback, prisma } from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

/** Records a learner's vote on a piece of content (an upvote on a step unless overridden). */
export async function contentFeedbackFixture(
  attrs: FixtureAttrs<ContentFeedback> & Pick<ContentFeedback, "contentId" | "userId">,
) {
  return prisma.contentFeedback.create({ data: { contentKind: "step", vote: "up", ...attrs } });
}

/** Stores a feedback form message. */
export async function feedbackFixture(attrs?: FixtureAttrs<Feedback, "context">) {
  return prisma.feedback.create({
    data: { context: { screen: "test" }, message: "Test feedback message", ...attrs },
  });
}

import { type Feedback, prisma } from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

/** Stores a feedback form message. */
export async function feedbackFixture(attrs?: FixtureAttrs<Feedback, "context">) {
  return prisma.feedback.create({
    data: { context: { screen: "test" }, message: "Test feedback message", ...attrs },
  });
}

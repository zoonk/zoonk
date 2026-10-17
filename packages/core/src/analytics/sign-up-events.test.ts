import { reportSignUp } from "@zoonk/auth/sign-up-events";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { trackServerEvent } from "./server";
import { registerSignUpAnalytics } from "./sign-up-events";

function signUpEvent({ fromGuest, userId }: { fromGuest: boolean; userId: string }): unknown {
  return expect.objectContaining({
    distinctId: userId,
    name: "Sign Up Completed",
    properties: { from_guest: fromGuest },
  });
}

describe(registerSignUpAnalytics, () => {
  it("sends Sign Up Completed after the response, saying whether a guest's learning came along", async () => {
    const settle = runDeferredWork();
    registerSignUpAnalytics();

    const [fresh, withGoal, withLesson] = await Promise.all([
      userFixture(),
      userFixture(),
      userFixture(),
    ]);

    await Promise.all([
      goalFixture({ userId: withGoal.id }),
      learningEventFixture({ contentIds: {}, userId: withLesson.id }),
    ]);

    await Promise.all(
      [fresh, withGoal, withLesson].map((user) => reportSignUp({ userId: user.id })),
    );

    expect(trackServerEvent).not.toHaveBeenCalled();
    await settle();

    expect(trackServerEvent).toHaveBeenCalledTimes(3);

    expect(trackServerEvent).toHaveBeenCalledWith(
      signUpEvent({ fromGuest: false, userId: fresh.id }),
    );

    expect(trackServerEvent).toHaveBeenCalledWith(
      signUpEvent({ fromGuest: true, userId: withGoal.id }),
    );

    expect(trackServerEvent).toHaveBeenCalledWith(
      signUpEvent({ fromGuest: true, userId: withLesson.id }),
    );
  });
});

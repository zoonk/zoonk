import { reportAuthEvent } from "@zoonk/auth/auth-events";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { registerAuthAnalytics } from "./auth-events";
import { trackServerEvent } from "./server";

function signUpEvent({ fromGuest, userId }: { fromGuest: boolean; userId: string }): unknown {
  return expect.objectContaining({
    distinctId: userId,
    name: "Sign Up Completed",
    properties: { from_guest: fromGuest },
  });
}

async function adultLearner() {
  const user = await userFixture();
  await learningProfileFixture({ birthYear: 1990, userId: user.id });
  return user;
}

describe(registerAuthAnalytics, () => {
  it("sends Sign Up Completed after the response, saying whether a guest's learning came along", async () => {
    const settle = runDeferredWork();
    registerAuthAnalytics();

    const [fresh, withGoal, withLesson] = await Promise.all([
      adultLearner(),
      adultLearner(),
      adultLearner(),
    ]);

    await Promise.all([
      goalFixture({ userId: withGoal.id }),
      learningEventFixture({ contentIds: {}, userId: withLesson.id }),
    ]);

    await Promise.all(
      [fresh, withGoal, withLesson].map((user) =>
        reportAuthEvent({ name: "sign-up", userId: user.id }),
      ),
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

  it("sends Sign In Method Chosen after the response, with the method", async () => {
    const settle = runDeferredWork();
    registerAuthAnalytics();
    const user = await adultLearner();

    await reportAuthEvent({ method: "google", name: "sign-in", userId: user.id });

    expect(trackServerEvent).not.toHaveBeenCalled();
    await settle();

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Sign In Method Chosen",
        properties: { method: "google" },
      }),
    );
  });
});

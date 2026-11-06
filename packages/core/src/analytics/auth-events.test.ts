import { reportAuthEvent } from "@zoonk/auth/auth-events";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { USAGE_DATA_COOKIE } from "@zoonk/utils/usage-data";
import { cookies, headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { registerServerSinks } from "../server-sinks";
import { trackAuthEvent, trackSignInCompleted } from "./auth-events";
import { trackServerEvent } from "./server";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

function signUpEvent({ fromGuest, userId }: { fromGuest: boolean; userId: string }): unknown {
  return expect.objectContaining({
    distinctId: userId,
    name: "Sign Up Completed",
    properties: { from_guest: fromGuest },
  });
}

describe(trackAuthEvent, () => {
  it("sends Sign Up Completed after the response, saying whether a guest's learning came along", async () => {
    const settle = runDeferredWork();
    registerServerSinks();

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
    registerServerSinks();
    const user = await userFixture();

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

describe(trackSignInCompleted, () => {
  it("names the browser that finished signing in", async () => {
    const user = await userFixture();
    vi.mocked(headers).mockResolvedValue(new Headers({ "user-agent": BROWSER_USER_AGENT }));

    await trackSignInCompleted({ locale: "pt", userId: user.id });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Sign In Completed",
        shared: expect.objectContaining({ locale: "pt", platform: "web" }),
      }),
    );
  });

  it("sends nothing when the browser said no before its new account knows", async () => {
    const user = await userFixture();
    vi.mocked(headers).mockResolvedValue(new Headers({ "user-agent": BROWSER_USER_AGENT }));

    vi.mocked(cookies).mockResolvedValue(
      new Map([[USAGE_DATA_COOKIE, { name: USAGE_DATA_COOKIE, value: "off" }]]) as never,
    );

    await trackSignInCompleted({ locale: "en", userId: user.id });

    expect(trackServerEvent).not.toHaveBeenCalled();
  });
});

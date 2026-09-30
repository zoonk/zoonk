import { userFixture } from "@zoonk/testing/fixtures/users";
import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { setExperienceMode } from "./experience-mode";
import { EXPERIENCE_MODE_COOKIE } from "./experience-mode-cookie";
import { getLearningProfile } from "./get-learning-profile";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** Cookies can only be written inside a Next.js request, which tests replace with a plain store. */
const cookieStore = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));

describe(setExperienceMode, () => {
  beforeEach(() => {
    vi.mocked(cookies).mockClear();
  });

  it("keeps a visitor's mode on the device", async () => {
    mockSession(null);

    await setExperienceMode("fun");

    expect(cookieStore.set).toHaveBeenCalledWith(
      EXPERIENCE_MODE_COOKIE,
      "fun",
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    );
  });

  it("saves the mode on the profile of a learner with a session, and on the device", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await setExperienceMode("fun");

    await expect(getLearningProfile()).resolves.toMatchObject({ experienceMode: "fun" });
    expect(cookieStore.set).toHaveBeenCalledWith(EXPERIENCE_MODE_COOKIE, "fun", expect.anything());
  });
});

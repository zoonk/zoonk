import { getUserSessionCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { auth } from "@zoonk/core/auth";
import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { profileFormAction } from "./actions";

vi.mock("@zoonk/core/auth", () => ({ auth: { api: { updateUser: vi.fn() } } }));
vi.mock("@/data/users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

/** Creates the valid browser form payload shared by profile action examples. */
function createProfileFormData(): FormData {
  const formData = new FormData();
  formData.set("name", "Updated learner");
  formData.set("username", "updated-learner");
  return formData;
}

describe(profileFormAction, () => {
  beforeEach(() => {
    vi.mocked(headers).mockResolvedValue(new Headers());

    vi.mocked(getSession).mockResolvedValue({
      user: { id: "profile-user", username: "old-username" },
    } as never);
  });

  it("expires the private session after a successful profile update", async () => {
    vi.mocked(auth.api.updateUser).mockResolvedValue(undefined as never);

    const result = await profileFormAction(null, createProfileFormData());

    expect(result.status).toBe("success");
    expect(updateTag).toHaveBeenCalledExactlyOnceWith(getUserSessionCacheTag("profile-user"));
  });

  it("keeps the current private session when the profile update fails", async () => {
    vi.mocked(auth.api.updateUser).mockRejectedValue(new Error("update failed"));

    const result = await profileFormAction(null, createProfileFormData());

    expect(result.status).toBe("error");
    expect(updateTag).not.toHaveBeenCalled();
  });
});

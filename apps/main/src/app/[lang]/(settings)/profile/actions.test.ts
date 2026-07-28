import { updateCurrentUser } from "@zoonk/core/users/current";
import { describe, expect, it, vi } from "vitest";
import { profileFormAction } from "./actions";

vi.mock("@zoonk/core/users/current", () => ({ updateCurrentUser: vi.fn() }));

/** Creates the valid browser form payload shared by profile action examples. */
function createProfileFormData(): FormData {
  const formData = new FormData();
  formData.set("name", "Updated learner");
  formData.set("username", "updated-learner");
  return formData;
}

describe(profileFormAction, () => {
  it("submits a valid profile update", async () => {
    vi.mocked(updateCurrentUser).mockResolvedValue({} as never);

    const result = await profileFormAction(null, createProfileFormData());

    expect(result.status).toBe("success");

    expect(updateCurrentUser).toHaveBeenCalledExactlyOnceWith({
      input: { name: "Updated learner", username: "updated-learner" },
    });
  });

  it("returns an error when the profile update fails", async () => {
    vi.mocked(updateCurrentUser).mockRejectedValue(new Error("update failed"));

    const result = await profileFormAction(null, createProfileFormData());

    expect(result.status).toBe("error");
  });
});

import { NativeAuthResponseError } from "@zoonk/auth/errors";
import { NAME_TOO_LONG_ERROR_CODE } from "@zoonk/auth/name-rules";
import { updateCurrentUser } from "@zoonk/core/users/current";
import { describe, expect, it, vi } from "vitest";
import { profileFormAction } from "./actions";

vi.mock("@zoonk/core/users/current", () => ({ updateCurrentUser: vi.fn() }));

function createProfileFormData(): FormData {
  const formData = new FormData();
  formData.set("name", "Updated learner");
  formData.set("username", "updated_learner");
  return formData;
}

describe(profileFormAction, () => {
  it("submits a valid profile update", async () => {
    vi.mocked(updateCurrentUser).mockResolvedValue({} as never);

    const result = await profileFormAction(null, createProfileFormData());

    expect(result.status).toBe("success");

    expect(updateCurrentUser).toHaveBeenCalledExactlyOnceWith({
      input: { name: "Updated learner", username: "updated_learner" },
    });
  });

  it("names a name the server refused as too long", async () => {
    vi.mocked(updateCurrentUser).mockRejectedValue(
      new NativeAuthResponseError({ body: { code: NAME_TOO_LONG_ERROR_CODE }, statusCode: 400 }),
    );

    const result = await profileFormAction(null, createProfileFormData());

    expect(result.status).toBe("nameTooLong");
  });

  it("returns an error when the profile update fails", async () => {
    vi.mocked(updateCurrentUser).mockRejectedValue(new Error("update failed"));

    const result = await profileFormAction(null, createProfileFormData());

    expect(result.status).toBe("error");
  });
});

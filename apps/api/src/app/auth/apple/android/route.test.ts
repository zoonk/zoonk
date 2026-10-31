import { describe, expect, it } from "vitest";
import { POST as reflectAppleForm } from "./route";

const REFLECTOR_URL = "https://api.zoonk.com/auth/apple/android";

const appleForm = {
  code: "c0de.single-use",
  id_token: "header.payload.signature",
  state: "app-state_42",
  user: JSON.stringify({
    email: "ada+zoonk@privaterelay.appleid.com",
    name: { firstName: "Ada", lastName: "Lovelace" },
  }),
};

function postForm(
  fields: Record<string, string>,
  contentType = "application/x-www-form-urlencoded",
) {
  return reflectAppleForm(
    new Request(REFLECTOR_URL, {
      body: new URLSearchParams(fields).toString(),
      headers: { "content-type": contentType, cookie: "zoonk.session_token=guest" },
      method: "POST",
    }),
  );
}

/** The fields the app reads from the App Link's fragment, decoded as URI components. */
function readFragment(response: Response) {
  const location = new URL(response.headers.get("location") ?? "");

  return {
    fields: Object.fromEntries(
      location.hash
        .slice(1)
        .split("&")
        .map((pair) => pair.split("=").map((part) => decodeURIComponent(part))),
    ),
    target: `${location.origin}${location.pathname}${location.search}`,
  };
}

describe("Apple's form post to the Android app", () => {
  it("redirects only Apple's fields to the App Link, in the fragment", async () => {
    const response = await postForm({ ...appleForm, extra: "dropped", locale: "pt" });
    const { fields, target } = readFragment(response);

    expect(response.status).toBe(303);
    expect(target).toBe("https://zoonk.com/auth/apple");
    expect(fields).toStrictEqual(appleForm);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("keeps a cancelled authorization's error and state", async () => {
    const response = await postForm({ error: "user_cancelled_authorize", state: "app-state_42" });

    expect(response.status).toBe(303);

    expect(readFragment(response).fields).toStrictEqual({
      error: "user_cancelled_authorize",
      state: "app-state_42",
    });
  });

  it("encodes values so a plus and a space survive any decoder", async () => {
    const response = await postForm({ state: "a+b c" });

    expect(response.headers.get("location")).toBe("https://zoonk.com/auth/apple#state=a%2Bb%20c");
  });

  it("refuses a field longer than any Apple sends", async () => {
    const response = await postForm({ ...appleForm, id_token: "x".repeat(8193) });

    expect(response.status).toBe(400);
    expect(response.headers.has("location")).toBe(false);
  });

  it("refuses a body that isn't a form", async () => {
    const response = await postForm(appleForm, "application/json");

    expect(response.status).toBe(400);
    expect(response.headers.has("location")).toBe(false);
  });
});

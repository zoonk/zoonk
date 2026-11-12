import { afterEach, describe, expect, it, vi } from "vitest";

const CENTRAL_SIGN_OUT = "/v1/auth/sign-out";

/**
 * A failing host can't be produced on demand with the real servers, so the browser's fetch is
 * stubbed before the client loads, since Better Auth keeps the `fetch` it finds then.
 */
async function loadLogoutInBrowser({
  app,
  central,
}: {
  app: "fails" | "succeeds";
  central: "fails" | "succeeds";
}) {
  const location = { href: "http://localhost:3000/today" };

  vi.stubGlobal("location", location);

  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    const outcome = url.includes(CENTRAL_SIGN_OUT) ? central : app;

    if (outcome === "fails") {
      throw new TypeError("Failed to fetch");
    }

    return Response.json({ success: true });
  });

  vi.resetModules();
  const { logout } = await import("./client");

  return { location, logout };
}

describe("logout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leaves the signed-in page once this app's session ended, even when central auth can't be reached", async () => {
    const { location, logout } = await loadLogoutInBrowser({ app: "succeeds", central: "fails" });

    await logout();

    expect(location.href).toBe("/");
  });

  it("stays on the page when this app's session didn't end", async () => {
    const { location, logout } = await loadLogoutInBrowser({ app: "fails", central: "succeeds" });

    await logout();

    expect(location.href).toBe("http://localhost:3000/today");
  });
});

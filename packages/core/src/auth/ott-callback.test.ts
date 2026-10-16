import { type NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { verifyOneTimeTokenCallback } from "./ott-callback";

/** Missing state exercises rejection before Better Auth or any token redemption can run. */
function callbackRequest(path: string): NextRequest {
  return {
    cookies: { get: () => {} },
    headers: new Headers(),
    nextUrl: new URL(path, "http://localhost:3000"),
  } as unknown as NextRequest;
}

describe("failed callback recovery", () => {
  it("ends a second failed callback instead of starting another automatic sign-in", async () => {
    const response = await verifyOneTimeTokenCallback(
      callbackRequest("/auth/callback?error=auth&token=bad&next=%2Fplan"),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("allows one retry, preserves a safe destination, and rejects an open redirect", async () => {
    const first = await verifyOneTimeTokenCallback(callbackRequest("/auth/callback?next=%2Fplan"));
    expect(first.headers.get("location")).toBe("/login?error=auth&next=%2Fplan");

    const unsafe = await verifyOneTimeTokenCallback(
      callbackRequest("/auth/callback?next=https%3A%2F%2Fevil.example"),
    );

    expect(unsafe.headers.get("location")).toBe("/login?error=auth");
  });
});

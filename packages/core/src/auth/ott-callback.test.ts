import { type NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  getOneTimeTokenCallbackPage,
  getOneTimeTokenFailurePage,
  verifyOneTimeTokenCallback,
} from "./ott-callback";

/** Missing state exercises rejection before Better Auth or any token redemption can run. */
function callbackRequest(path: string): NextRequest {
  return {
    cookies: { get: () => {} },
    headers: new Headers(),
    nextUrl: new URL(path, "http://localhost:3000"),
  } as unknown as NextRequest;
}

const PAGE_COPY = {
  action: "Continue <now>",
  lang: "pt",
  restart: "Sign in <again>",
  title: "Entrando & seguindo",
};

describe("following a sign-in link", () => {
  it("only shows a page that posts itself: no cookie, no token in the page, nothing kept", async () => {
    const response = getOneTimeTokenCallbackPage({
      copy: PAGE_COPY,
      request: callbackRequest("/auth/callback?state=s1&token=secret-token&next=%2Fplan"),
      restartHref: '/login?next="/plan"',
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(html).not.toContain("secret-token");
    expect(html).toMatch(/<form id="[\w-]+" method="post">/u);
    expect(html).toContain('<html lang="pt">');
    expect(html).toContain("<title>Entrando &amp; seguindo</title>");
    expect(html).toContain('<button type="submit">Continue &lt;now&gt;</button>');

    // Outside the form the script hides: a stopped post can still start a fresh sign-in.
    expect(html).toContain(
      '</form><p><a href="/login?next=&quot;/plan&quot;">Sign in &lt;again&gt;</a></p>',
    );

    expect(html).toMatch(
      /<script>\{const f=document\.getElementById\("[\w-]+"\);f\.hidden=true;f\.submit\(\)\}<\/script>/u,
    );
  });

  it("sends a link without a token back to sign in, as a finished one would", async () => {
    const response = getOneTimeTokenCallbackPage({
      copy: PAGE_COPY,
      request: callbackRequest("/auth/callback?next=%2Fplan"),
      restartHref: "/login?next=%2Fplan",
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login?error=auth&next=%2Fplan");
  });
});

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
    expect(first.status).toBe(303);
    expect(first.headers.get("location")).toBe("/login?error=auth&next=%2Fplan");
    expect(first.headers.get("referrer-policy")).toBe("no-referrer");

    const unsafe = await verifyOneTimeTokenCallback(
      callbackRequest("/auth/callback?next=https%3A%2F%2Fevil.example"),
    );

    expect(unsafe.headers.get("location")).toBe("/login?error=auth");
  });

  it("says the sign-in couldn't finish, with a way to try again, keeping the failed answer's cookies", async () => {
    const failed = new Response(null, {
      headers: { "Cache-Control": "no-store", "set-cookie": "state=; Max-Age=0; Path=/" },
      status: 401,
    });

    const response = getOneTimeTokenFailurePage({
      copy: { lang: "en", retry: "Try <again>", title: "We couldn't sign you in." },
      href: '/login?next="/plan"',
      response: failed,
    });

    const html = await response.text();

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(html).toContain("<h1>We couldn&#39;t sign you in.</h1>");
    expect(html).toContain('<a href="/login?next=&quot;/plan&quot;">Try &lt;again&gt;</a>');
  });
});

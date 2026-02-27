import { getBaseURL } from "@zoonk/e2e/helpers";
import { expect, test } from "./fixtures";

test.describe("robots.txt", () => {
  test("disallows private pages", async () => {
    const response = await fetch(`${getBaseURL()}/robots.txt`);
    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toContain("Disallow: /auth/");
    expect(body).toContain("Disallow: /login");
    expect(body).toContain("Disallow: /generate/");
    expect(body).toContain("Sitemap:");
  });
});

test.describe("sitemap.xml", () => {
  test("returns static page URLs", async () => {
    const response = await fetch(`${getBaseURL()}/sitemap.xml`);
    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toContain("https://www.zoonk.com");
    expect(body).toContain("https://www.zoonk.com/courses");
  });
});

test.describe("course sitemaps", () => {
  test("returns valid sitemap XML", async () => {
    const response = await fetch(`${getBaseURL()}/sitemaps/courses/sitemap/0.xml`);
    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toContain("<urlset");
  });
});

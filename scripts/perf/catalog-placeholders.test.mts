import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "vitest";
import { catalogFixture, check, fixture } from "./artifact-test-fixture.mts";

describe("declared catalog placeholders", () => {
  it.each(["", "/ch/[chapterSlug]", "/ch/[chapterSlug]/l/[lessonSlug]"])(
    "accepts only the declared 404 placeholder for catalog depth %s",
    async (suffix) => {
      const data = await catalogFixture(suffix);

      try {
        const result = await check(data, "static");

        assert.match(result.stdout, /PASS/u);
        await writeFile(`${data.artifact}.meta`, JSON.stringify({ headers: {}, status: 200 }));
        await assert.rejects(check(data, "static"), { code: 1, stderr: /expected 404/u });
      } finally {
        await rm(data.root, { recursive: true });
      }
    },
  );

  it.each([
    { html: "<p>Missing heading</p>", problem: /h1 missing/u },
    { html: "<h1>One</h1><h1>Two</h1>", problem: /exactly 1 h1/u },
    { html: '<h1>Not found</h1><div data-slot="skeleton"></div>', problem: /skeleton/u },
  ])("requires a complete placeholder first paint: $html", async ({ html, problem }) => {
    const data = await catalogFixture();

    try {
      await writeFile(`${data.artifact}.html`, html);
      await assert.rejects(check(data, "static"), { code: 1, stderr: problem });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });

  it.each([
    { headers: { "Set-Cookie": "bad=1" }, problem: /Set-Cookie/u },
    { postponed: "", problem: /postponed/u },
  ])("rejects placeholder cookies or postponed work: $problem", async ({ problem, ...meta }) => {
    const data = await catalogFixture();

    try {
      await writeFile(`${data.artifact}.meta`, JSON.stringify({ status: 404, ...meta }));
      await assert.rejects(check(data, "static"), { code: 1, stderr: problem });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });

  it.each(["/en/b/real/c/-", "/en/b/-/c/real", "/en/b/real/c/real"])(
    "rejects an undeclared 404 at %s",
    async (path) => {
      const data = await catalogFixture();

      try {
        const artifact = join(data.dist, "server/app", path.slice(1));
        await mkdir(join(artifact, ".."), { recursive: true });
        await writeFile(`${artifact}.html`, "<h1>Not found</h1>");
        await writeFile(`${artifact}.meta`, JSON.stringify({ status: 404 }));
        data.manifest.routes[path] = data.manifest.routes[data.path] ?? {};
        Reflect.deleteProperty(data.manifest.routes, data.path);
        await writeFile(join(data.dist, "prerender-manifest.json"), JSON.stringify(data.manifest));
        await assert.rejects(check(data, "static"), { code: 1, stderr: /content status=404/u });
      } finally {
        await rm(data.root, { recursive: true });
      }
    },
  );

  it("does not grant the placeholder status to another route group", async () => {
    const data = await catalogFixture();
    const directory = "[lang]/(other)/b/[brandSlug]/c/[courseSlug]";

    try {
      await rm(join(data.app, "[lang]/(catalog)"), { recursive: true });
      await mkdir(join(data.app, directory), { recursive: true });

      await writeFile(
        join(data.app, directory, "page.tsx"),
        "export const ensureStatic = 'navigation';",
      );

      await assert.rejects(check(data, "static"), { code: 1, stderr: /content status=404/u });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });

  it.each([
    { path: "/en/b/-/c/-/ch/real", suffix: "/ch/[chapterSlug]" },
    { path: "/en/b/-/c/-/ch/-/l/real", suffix: "/ch/[chapterSlug]/l/[lessonSlug]" },
  ])("checks every catalog segment at $path", async ({ suffix, path }) => {
    const data = await catalogFixture(suffix);

    try {
      const artifact = join(data.dist, "server/app", path.slice(1));
      await mkdir(join(artifact, ".."), { recursive: true });
      await writeFile(`${artifact}.html`, "<h1>Not found</h1>");
      await writeFile(`${artifact}.meta`, JSON.stringify({ status: 404 }));
      data.manifest.routes[path] = data.manifest.routes[data.path] ?? {};
      Reflect.deleteProperty(data.manifest.routes, data.path);
      await writeFile(join(data.dist, "prerender-manifest.json"), JSON.stringify(data.manifest));
      await assert.rejects(check(data, "static"), { code: 1, stderr: /content status=404/u });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });

  it("rejects postponed work even on a successful content page", async () => {
    const data = await fixture();

    try {
      await writeFile(
        join(data.dist, "server/app/en.meta"),
        JSON.stringify({ postponed: "", status: 200 }),
      );

      await assert.rejects(check(data, "static"), { code: 1, stderr: /postponed/u });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });
});

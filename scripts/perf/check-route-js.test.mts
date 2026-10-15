import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "vitest";
import { check, fixture } from "./artifact-test-fixture.mts";

describe("static redirect artifacts", () => {
  it("accepts a persisted redirect without an h1 and rejects Set-Cookie", async () => {
    const data = await fixture();
    const headers = { location: "https://blog.zoonk.com" };

    try {
      await Promise.all([
        writeFile(join(data.dist, "server/app/en.html"), "<html><body></body></html>"),
        writeFile(join(data.dist, "server/app/en.meta"), JSON.stringify({ headers, status: 307 })),
        writeFile(
          join(data.dist, "server/app/en.rsc"),
          '1:E{"digest":"NEXT_REDIRECT;replace;https://blog.zoonk.com;307;"}\n',
        ),
      ]);

      const result = await check(data, "static");
      assert.match(result.stdout, /PASS/u);

      await writeFile(
        join(data.dist, "server/app/en.meta"),
        JSON.stringify({ headers: { ...headers, "Set-Cookie": "bad=1" }, status: 307 }),
      );

      await assert.rejects(check(data, "static"), { code: 1, stderr: /Set-Cookie/u });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });
});

describe("route artifact gates", () => {
  it("requires static server output with Next's navigation marker, including dynamic fallbacks", async () => {
    const data = await fixture();

    try {
      Object.assign(data.manifest.routes["/en"] ?? {}, {
        _isEnsureStaticPage: true,
        compute: "resuming",
        renderingMode: "PARTIALLY_STATIC",
        response: "initial",
      });

      await writeFile(join(data.dist, "prerender-manifest.json"), JSON.stringify(data.manifest));
      await assert.rejects(check(data, "static"), { code: 1, stderr: /compute=resuming/u });
      // Next prints this as ○: browser-deferred UI is pending, but no server work resumes.
      Object.assign(data.manifest.routes["/en"] ?? {}, { compute: "static" });

      data.manifest.dynamicRoutes["/[lang]"] = {
        _isEnsureStaticPage: true,
        compute: "blocking",
        renderingMode: "PARTIALLY_STATIC",
        response: "empty",
      };

      await writeFile(join(data.dist, "prerender-manifest.json"), JSON.stringify(data.manifest));
      const result = await check(data, "static");
      assert.match(result.stdout, /PASS/u);

      Object.assign(data.manifest.routes["/en"] ?? {}, { response: "empty" });
      await writeFile(join(data.dist, "prerender-manifest.json"), JSON.stringify(data.manifest));
      await assert.rejects(check(data, "static"), { code: 1, stderr: /response=empty/u });
      Object.assign(data.manifest.routes["/en"] ?? {}, { response: "initial" });

      data.manifest.dynamicRoutes["/[lang]"] = { renderingMode: "PARTIALLY_STATIC" };
      await writeFile(join(data.dist, "prerender-manifest.json"), JSON.stringify(data.manifest));

      await assert.rejects(check(data, "static"), {
        code: 1,
        stderr: /dynamic fallback is PARTIALLY_STATIC/u,
      });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });

  it("route JS deduplicates chunks and allows exactly 3 percent growth", async () => {
    const data = await fixture();

    try {
      const before = await readFile(data.budgets, "utf8");
      const { stdout } = await check(data, "js");
      assert.match(stdout, /PASS/u);
      assert.match(stdout, /3\.00%/u);
      assert.equal(await readFile(data.budgets, "utf8"), before);
      await writeFile(data.budgets, JSON.stringify({ routes: { "/[lang]": 99 }, version: 1 }));
      await assert.rejects(check(data, "js"), { code: 1, stderr: /exceeds 3%/u });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });

  it("route JS rejects missing chunks, routes, and unbudgeted additions", async () => {
    const data = await fixture();

    try {
      await writeFile(data.budgets, JSON.stringify({ routes: {}, version: 1 }));
      await assert.rejects(check(data, "js"), { code: 1 });
      await writeFile(data.budgets, JSON.stringify({ routes: { "/removed": 100 }, version: 1 }));
      await assert.rejects(check(data, "js"), { code: 1, stderr: /budgeted route missing/u });
      await rm(join(data.dist, "static/chunks/shared.js"));
      await assert.rejects(check(data, "js"), { code: 1 });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });
});

describe("navigation static route and artifact derivation", () => {
  it("static pages are derived from page and ancestor layout exports", async () => {
    const data = await fixture();

    try {
      const { stdout } = await check(data, "static");
      assert.match(stdout, /Derived navigation routes \(1\)/u);

      await writeFile(
        join(data.app, "[lang]/(public)/page.tsx"),
        '// export const ensureStatic = "navigation";\nconst example = "export const ensureStatic = \'navigation\'";',
      );

      const empty = await check(data, "static");
      assert.match(empty.stdout, /Derived navigation routes \(0\)/u);

      await writeFile(
        join(data.app, "[lang]/layout.tsx"),
        'export const ensureStatic: string = "navigation";',
      );

      const inherited = await check(data, "static");
      assert.match(inherited.stdout, /Derived navigation routes \(1\)/u);
      await mkdir(join(data.app, "[lang]/new"));
      await writeFile(join(data.app, "[lang]/new/page.tsx"), "export default function Page() {}");

      await assert.rejects(check(data, "static"), {
        code: 1,
        stderr: /\/\[lang\]\/new: no prerendered page/u,
      });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });

  it.each([
    { ensured: false, html: "<h1>Title</h1>", mode: "STATIC", passes: true },
    {
      ensured: true,
      html: "<h1>Complete static navigation</h1>",
      mode: "PARTIALLY_STATIC",
      passes: true,
    },
    { html: "<h1>Title</h1>", mode: "PARTIALLY_STATIC", passes: false },
    {
      html: '<script>"<h1>fake</h1>"</script><!-- <h1>fake</h1> -->',
      mode: "STATIC",
      passes: false,
    },
    { html: '<div title="<h1>fake</h1>"></div>', mode: "STATIC", passes: false },
    { html: "<h1>One</h1><h1>Two</h1>", mode: "STATIC", passes: false },
    { html: '<h1>Title</h1><div data-slot="skeleton"></div>', mode: "STATIC", passes: false },
    { html: "<h1>Title</h1><div data-slot=skeleton></div>", mode: "STATIC", passes: false },
  ])("static artifact $mode: $html", async ({ html, mode, passes, ensured }) => {
    const data = await fixture();

    try {
      Object.assign(data.manifest.routes["/en"] ?? {}, {
        _isEnsureStaticPage: ensured,
        renderingMode: mode,
      });

      await Promise.all([
        writeFile(join(data.dist, "server/app/en.html"), html),
        writeFile(join(data.dist, "prerender-manifest.json"), JSON.stringify(data.manifest)),
      ]);

      if (passes) {
        const checked = await check(data, "static");
        assert.match(checked.stdout, /PASS/u);
      } else {
        await assert.rejects(check(data, "static"), { code: 1 });
      }
    } finally {
      await rm(data.root, { recursive: true });
    }
  });

  it("static metadata requires a STATIC complete entry and a nonempty body", async () => {
    const data = await fixture();

    try {
      Object.assign(data.manifest.routes["/robots.txt"] ?? {}, {
        renderingMode: "PARTIALLY_STATIC",
      });

      await writeFile(join(data.dist, "prerender-manifest.json"), JSON.stringify(data.manifest));

      await assert.rejects(check(data, "static"), {
        code: 1,
        stderr: /robots\.txt: renderingMode=PARTIALLY_STATIC/u,
      });

      Object.assign(data.manifest.routes["/robots.txt"] ?? {}, { renderingMode: "STATIC" });
      await writeFile(join(data.dist, "prerender-manifest.json"), JSON.stringify(data.manifest));
      await writeFile(join(data.dist, "server/app/robots.txt.body"), "");
      await assert.rejects(check(data, "static"), { code: 1, stderr: /robots\.txt: empty body/u });
      await writeFile(join(data.dist, "server/app/robots.txt.body"), "robots");

      await writeFile(
        join(data.dist, "server/app/robots.txt.meta"),
        JSON.stringify({ headers: { "Set-Cookie": "bad=1" }, status: 200 }),
      );

      await assert.rejects(check(data, "static"), {
        code: 1,
        stderr: /Set-Cookie in metadata response/u,
      });
    } finally {
      await rm(data.root, { recursive: true });
    }
  });
});

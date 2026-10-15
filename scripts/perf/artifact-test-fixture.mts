import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const script = resolve(import.meta.dirname, "check-route-js.mts");

export async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "zoonk-perf-gate-"));
  const dist = join(root, ".next-e2e");
  const app = join(root, "app");
  const budgets = join(root, "budgets.json");

  await Promise.all([
    mkdir(join(dist, "diagnostics"), { recursive: true }),
    mkdir(join(dist, "static/chunks"), { recursive: true }),
    mkdir(join(dist, "server/app/en"), { recursive: true }),
    mkdir(join(app, "[lang]/(public)"), { recursive: true }),
    mkdir(join(root, "data/catalog"), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(
      join(dist, "static/chunks/shared.js"),
      Buffer.from(Array.from({ length: 83 }, (_, index) => index)),
    ),
    writeFile(
      join(dist, "diagnostics/route-bundle-stats.json"),
      JSON.stringify([
        {
          firstLoadChunkPaths: [
            ".next-e2e/static/chunks/shared.js",
            ".next-e2e/static/chunks/shared.js",
          ],
          route: "/[lang]",
        },
      ]),
    ),
    writeFile(budgets, JSON.stringify({ routes: { "/[lang]": 100 }, version: 1 })),
    writeFile(
      join(root, "data/catalog/catalog-static-params.ts"),
      'const UNLISTED_ROUTE = { brandSlug: "-", chapterSlug: "-", courseSlug: "-", lessonSlug: "-" };',
    ),
    writeFile(join(app, "[lang]/(public)/page.tsx"), "export const ensureStatic = 'navigation';"),
    writeFile(join(dist, "server/app/en.html"), "<h1>Title</h1>"),
    writeFile(join(dist, "server/app/en.meta"), JSON.stringify({ headers: {}, status: 200 })),
  ]);

  const metadata = [
    "/robots.txt",
    "/sitemap.xml",
    "/sitemaps/courses/sitemap/[__metadata_id__]",
    "/sitemaps/library-chapters/sitemap/[__metadata_id__]",
    "/sitemaps/library-lessons/sitemap/[__metadata_id__]",
    "/[lang]/opengraph-image",
  ];

  const routes = Object.fromEntries(
    metadata.map((source) => [
      source.replace("[lang]", "en").replace("[__metadata_id__]", "0.xml"),
      {
        compute: "static",
        renderingMode: "STATIC",
        response: "complete",
        routeType: "route",
        srcRoute: source,
      },
    ]),
  );

  await Promise.all(
    Object.keys(routes).map(async (path) => {
      const body = join(dist, "server/app", `${path.slice(1)}.body`);
      await mkdir(join(body, ".."), { recursive: true });
      await writeFile(body, "metadata");

      await writeFile(
        body.replace(/\.body$/u, ".meta"),
        JSON.stringify({ headers: {}, status: 200 }),
      );
    }),
  );

  const manifest: { routes: Record<string, object>; dynamicRoutes: Record<string, object> } = {
    dynamicRoutes: {},
    routes: {
      ...routes,
      "/en": {
        compute: "static",
        renderingMode: "STATIC",
        response: "complete",
        routeType: "page",
        srcRoute: "/[lang]",
      },
    },
  };

  await writeFile(join(dist, "prerender-manifest.json"), JSON.stringify(manifest));
  return { app, budgets, dist, manifest, root };
}

export async function check(data: Awaited<ReturnType<typeof fixture>>, mode: string) {
  return run(process.execPath, [
    script,
    "--mode",
    mode,
    "--dist",
    data.dist,
    "--app",
    data.app,
    "--budgets",
    data.budgets,
  ]);
}

export async function catalogFixture(suffix = "") {
  const data = await fixture();
  const directory = `[lang]/(catalog)/b/[brandSlug]/c/[courseSlug]${suffix}`;
  const source = `/${directory.replace("(catalog)/", "")}`;
  const path = source.replace("[lang]", "en").replaceAll(/\[\w+\]/gu, "-");
  const artifact = join(data.dist, "server/app", path.slice(1));
  await mkdir(join(data.app, directory), { recursive: true });
  await mkdir(join(artifact, ".."), { recursive: true });

  await writeFile(
    join(data.app, directory, "page.tsx"),
    "export const ensureStatic = 'navigation';",
  );

  await writeFile(`${artifact}.html`, "<h1>We couldn't find this page</h1>");
  await writeFile(`${artifact}.meta`, JSON.stringify({ headers: {}, status: 404 }));

  data.manifest.routes[path] = {
    _isEnsureStaticPage: true,
    compute: "static",
    renderingMode: "PARTIALLY_STATIC",
    response: "initial",
    routeType: "page",
    srcRoute: source,
  };

  await writeFile(join(data.dist, "prerender-manifest.json"), JSON.stringify(data.manifest));
  return { ...data, artifact, path, source };
}

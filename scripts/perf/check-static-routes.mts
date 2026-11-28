/* oxlint-disable no-console -- This CLI prints its result for CI. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  SITEMAP_PAGES,
  type SitemapResource,
  getSitemapPageIds,
} from "../../apps/main/src/data/sitemaps/sitemap-page-ids.ts";
import { SUPPORTED_LOCALES } from "../../packages/utils/src/locale.ts";
import { htmlMarkers } from "./html-markers.mts";
import { getCatalogPlaceholderMatcher, getNavigationRoutes } from "./navigation-routes.mts";
import { type PageMeta, getRedirectProblems, hasSetCookie } from "./redirect-artifacts.mts";

type Prerender = {
  _isEnsureStaticPage?: boolean;
  initialHeaders?: PageMeta["headers"];
  renderingMode?: string;
  routeType?: string;
  response?: string;
  compute?: string;
  initialStatus?: number;
  srcRoute?: string;
};

type PrerenderManifest = {
  routes: Record<string, Prerender>;
  dynamicRoutes: Record<string, Prerender>;
};

type Artifact = { artifact: string; problems: string[]; route: string; tags?: string[] };
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const REDIRECT_MIN = 300;
const REDIRECT_END = 400;
const IMPLICIT_TAG_PREFIX = "_N_T_";

const METADATA_SOURCES = [
  "/robots.txt",
  "/sitemap.xml",
  "/sitemaps/courses/sitemap/[__metadata_id__]",
  "/sitemaps/library-chapters/sitemap/[__metadata_id__]",
  "/sitemaps/library-lessons/sitemap/[__metadata_id__]",
  "/[lang]/opengraph-image",
];

const { values } = parseArgs({
  options: {
    app: { default: "apps/main/src/app", type: "string" },
    dist: { default: "apps/main/.next-e2e", type: "string" },
  },
});

const dist = resolve(values.dist);

async function json<T>(file: string): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Invalid build artifact shapes fail at the owning boundary.
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function staticProblems(entry: Prerender): string[] {
  const { _isEnsureStaticPage: ensureStaticPage } = entry;
  const navigationStatic = entry.routeType === "page" && ensureStaticPage === true;

  // Next's ○ pages can retain browser-only Suspense UI (response=initial) without
  // postponed server work. compute=static below distinguishes them from ◐ output.
  const responseStatic =
    entry.response === "complete" || (navigationStatic && entry.response === "initial");

  return [
    !(entry.renderingMode === "STATIC" || navigationStatic) &&
      `renderingMode=${entry.renderingMode ?? "missing"}`,
    !responseStatic && `response=${entry.response ?? "missing"}`,
    entry.compute !== "static" && `compute=${entry.compute ?? "missing"}`,
    hasSetCookie(entry.initialHeaders) && "Set-Cookie in prerender headers",
  ].filter((problem) => problem !== false);
}

function cacheTags(meta: PageMeta): string[] {
  return [meta.headers?.["x-next-cache-tags"] ?? ""]
    .flat()
    .join(",")
    .split(",")
    .filter((tag) => tag !== "" && !tag.startsWith(IMPLICIT_TAG_PREFIX));
}

/**
 * Next renders the root layout and its not-found into every page, so a tagged read there tags them
 * all, and each write to that tag re-renders the whole app.
 */
function sharedTagArtifacts(pages: Artifact[]): Artifact[] {
  const [first, ...rest] = pages;

  const shared =
    rest.length === 0
      ? []
      : (first?.tags ?? []).filter((tag) => rest.every((page) => page.tags?.includes(tag)));

  return shared.map((tag) => ({
    artifact: "cache tags",
    problems: [`carries ${tag}, so each write to it re-renders all of them`],
    route: "every page",
  }));
}

async function pageArtifact({
  entry,
  path,
  placeholder,
}: {
  entry: Prerender;
  path: string;
  placeholder: boolean;
}): Promise<Artifact> {
  const problems = staticProblems(entry);

  const artifact = path === "/" ? "index" : path.slice(1);
  const directory = resolve(dist, "server/app");

  const [html, meta] = await Promise.all([
    readFile(resolve(directory, `${artifact}.html`), "utf8"),
    json<PageMeta>(resolve(directory, `${artifact}.meta`)),
  ]);

  const markers = htmlMarkers(html);

  if (hasSetCookie(meta.headers)) {
    problems.push("Set-Cookie in page metadata");
  }

  if (Object.hasOwn(meta, "postponed")) {
    problems.push("postponed in page metadata");
  }

  if (!placeholder && meta.status && meta.status >= REDIRECT_MIN && meta.status < REDIRECT_END) {
    const flight = await readFile(resolve(directory, `${artifact}.rsc`), "utf8");
    problems.push(...getRedirectProblems({ flight, meta }));
  } else {
    const expectedStatus = placeholder ? HTTP_NOT_FOUND : HTTP_OK;

    if (meta.status !== expectedStatus) {
      problems.push(`content status=${meta.status ?? "missing"}, expected ${expectedStatus}`);
    }

    if (markers.headings === 0) {
      problems.push("h1 missing");
    } else if (markers.headings !== 1) {
      problems.push(`expected exactly 1 h1, found ${markers.headings}`);
    }
  }

  if (markers.skeletons > 0) {
    problems.push(`${markers.skeletons} skeleton markers`);
  }

  return { artifact: "HTML", problems, route: path, tags: cacheTags(meta) };
}

async function metadataArtifact({
  entry,
  path,
}: {
  entry: Prerender;
  path: string;
}): Promise<Artifact> {
  const problems = staticProblems(entry);

  const directory = resolve(dist, "server/app");

  const [body, meta] = await Promise.all([
    readFile(resolve(directory, `${path.slice(1)}.body`)),
    json<PageMeta>(resolve(directory, `${path.slice(1)}.meta`)),
  ]);

  if (meta.status !== HTTP_OK) {
    problems.push(`metadata status=${meta.status ?? "missing"}`);
  }

  if (hasSetCookie(meta.headers)) {
    problems.push("Set-Cookie in metadata response");
  }

  if (Object.hasOwn(meta, "postponed")) {
    problems.push("postponed in metadata response");
  }

  if (body.length === 0) {
    problems.push("empty body");
  }

  return { artifact: "metadata body", problems, route: path };
}

const SITEMAP_SOURCE = /^\/sitemaps\/(?<resource>[\w-]+)\/sitemap\/\[__metadata_id__\]$/u;

function isSitemapResource(resource: string | undefined): resource is SitemapResource {
  return resource !== undefined && Object.hasOwn(SITEMAP_PAGES, resource);
}

/**
 * Next silently renders a path on each request when its prerender fails, so every path a route
 * generates must be prerendered: each locale of a route whose only dynamic segment is the language,
 * and each page of a sitemap.
 */
function expectedPaths(source: string): string[] {
  const resource = SITEMAP_SOURCE.exec(source)?.groups?.resource;

  if (isSitemapResource(resource)) {
    return getSitemapPageIds(resource).map((id) =>
      source.replace("[__metadata_id__]", `${id}.xml`),
    );
  }

  const segments = source.match(/\[[^\]]+\]/gu) ?? [];

  if (segments.length !== 1 || segments[0] !== "[lang]") {
    return [];
  }

  return SUPPORTED_LOCALES.map((locale) => source.replace("[lang]", locale));
}

async function routeArtifacts({
  manifest,
  metadata,
  isPlaceholder,
  source,
}: {
  manifest: PrerenderManifest;
  metadata: boolean;
  isPlaceholder: (source: string, path: string) => boolean;
  source: string;
}): Promise<Artifact[]> {
  const entries = Object.entries(manifest.routes).filter(
    ([path, entry]) => (entry.srcRoute ?? path) === source,
  );

  const artifact = metadata ? "metadata body" : "HTML";
  const prerendered = new Set(entries.map(([path]) => path));
  const missing = expectedPaths(source).filter((path) => !prerendered.has(path));

  const missingArtifacts =
    missing.length > 0
      ? [{ artifact, problems: [`not prerendered: ${missing.join(", ")}`], route: source }]
      : [];

  if (entries.length === 0) {
    return [
      {
        artifact,
        problems: [metadata ? "no static metadata artifact" : "no prerendered page"],
        route: source,
      },
      ...missingArtifacts,
    ];
  }

  const artifacts = await Promise.all(
    entries.map(([path, entry]) =>
      metadata
        ? metadataArtifact({ entry, path })
        : pageArtifact({ entry, path, placeholder: isPlaceholder(source, path) }),
    ),
  );

  const dynamic = manifest.dynamicRoutes[source];
  const fallback = dynamic?.renderingMode;
  const { _isEnsureStaticPage: navigationStatic } = dynamic ?? {};

  return [
    ...artifacts,
    ...missingArtifacts,
    ...(fallback && fallback !== "STATIC" && navigationStatic !== true
      ? [{ artifact: "fallback", problems: [`dynamic fallback is ${fallback}`], route: source }]
      : []),
  ];
}

async function checkStatic(): Promise<void> {
  const isPlaceholder = getCatalogPlaceholderMatcher(values.app);

  const [manifest, required] = await Promise.all([
    json<PrerenderManifest>(resolve(dist, "prerender-manifest.json")),
    getNavigationRoutes(values.app),
  ]);

  if (!manifest.routes || !manifest.dynamicRoutes) {
    throw new Error("Invalid prerender manifest.");
  }

  console.log(`Derived navigation routes (${required.length})`);

  const groups = await Promise.all([
    ...required.map((source) =>
      routeArtifacts({ isPlaceholder, manifest, metadata: false, source }),
    ),
    ...METADATA_SOURCES.map((source) =>
      routeArtifacts({ isPlaceholder, manifest, metadata: true, source }),
    ),
  ]);

  const routes = groups.flat();
  const artifacts = [...routes, ...sharedTagArtifacts(routes.filter(({ tags }) => tags))];

  const failures = artifacts
    .filter(({ problems }) => problems.length > 0)
    .map(({ artifact, problems, route }) => `${route}: ${problems.join(", ")} (${artifact})`);

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }

  console.log(`PASS: checked ${artifacts.length} prerender artifacts.`);
}

try {
  await checkStatic();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

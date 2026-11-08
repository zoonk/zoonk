import { createHmac } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { z } from "zod";
import { github, vercel, waitFor } from "./api.mts";
import { PROJECTS, requiredEnv } from "./config.mts";

type Target = "preview" | "staging" | "production";
type Project = (typeof PROJECTS)[number];

type CourseCacheAccess = { bypass: string | null; secret: string };

function getProject(app: Project["app"]): Project {
  const project = PROJECTS.find((candidate) => candidate.app === app);

  if (!project) {
    throw new Error(`Missing the ${app} project`);
  }

  return project;
}

/**
 * A preview's apps reach one another at aliases this deploy assigns, `<project>-pr-<number>-<team>.vercel.app`,
 * so every app knows the others' addresses before any of them builds. Vercel's own branch URL can't
 * be known ahead for a long branch name, which Vercel shortens in a way its docs don't spell out. The
 * apps trust preview origins by the team suffix.
 */
export function getAppUrl({
  app,
  target,
  teamSlug,
}: {
  app: Project["app"];
  target: Target;
  teamSlug: string;
}): string {
  const project = getProject(app);

  if (target === "preview") {
    return `https://${project.name}-pr-${requiredEnv("PR_NUMBER")}-${teamSlug}.vercel.app`;
  }

  return `https://${target === "production" ? project.productionDomain : project.stagingDomain}`;
}

async function getTeamSlug(): Promise<string> {
  const team = z
    .object({ slug: z.string() })
    .parse(await vercel({ path: `/v2/teams/${requiredEnv("VERCEL_ORG_ID")}` }));

  return team.slug;
}

const protectionBypassSchema = z.object({
  protectionBypass: z.record(z.string(), z.object({ scope: z.string() })).optional(),
});

/**
 * The secret comes from the PR database's address, so a run still working on a superseded API
 * deployment reaches the newer main app. Production and staging keep the projects' own values.
 */
async function getPreviewCacheAccess(): Promise<CourseCacheAccess> {
  const { protectionBypass = {} } = protectionBypassSchema.parse(
    await vercel({ path: `/v9/projects/${getProject("main").id}` }),
  );

  const bypass = Object.entries(protectionBypass).find(
    ([, value]) => value.scope === "automation-bypass",
  );

  const secret = createHmac("sha256", requiredEnv("DATABASE_URL"))
    .update("app-cache-secret")
    .digest("hex");

  return { bypass: bypass?.[0] ?? null, secret };
}

/**
 * Neon's URLs say `sslmode=require`, which pg 8 already treats as `verify-full` but warns about on
 * every boot, since pg 9 will stop verifying the certificate. Only the URL pg reads changes: Prisma's
 * CLI reads the unpooled one and would treat `verify-full` as `prefer`, falling back to plain TCP.
 */
function withVerifiedCertificate(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

const deploymentSchema = z.object({
  aliasAssigned: z.boolean().optional(),
  aliasError: z.unknown().optional(),
  readyState: z.string(),
  url: z.string(),
});

const deploymentPageSchema = z.object({
  deployments: z.array(
    z.object({
      meta: z
        .object({ ciPreviewPr: z.string().optional(), ciRunId: z.string().optional() })
        .optional(),
      target: z.string().nullable().optional(),
      uid: z.string(),
    }),
  ),
  pagination: z.object({ next: z.number().nullable().optional() }),
});

export async function assertPullRequestOpen(): Promise<void> {
  const pr = z
    .object({ state: z.string() })
    .parse(await github(`pulls/${requiredEnv("PR_NUMBER")}`));

  if (pr.state !== "open") {
    throw new Error("This preview's PR was closed");
  }
}

/** Stops the queued and building deployments this run started, or without a run, the PR's previews. */
export async function cancelBuilds({ runId }: { runId?: string } = {}): Promise<void> {
  async function cancelProject(project: Project): Promise<void> {
    const query = { limit: "100", projectId: project.id, state: "QUEUED,INITIALIZING,BUILDING" };

    async function cancelPage(until?: string): Promise<void> {
      const { deployments, pagination } = deploymentPageSchema.parse(
        await vercel({ path: "/v6/deployments", query: { ...query, ...(until ? { until } : {}) } }),
      );

      const obsolete = deployments.filter(
        (deployment) =>
          deployment.target !== "production" &&
          (runId
            ? deployment.meta?.ciRunId === runId
            : deployment.meta?.ciPreviewPr === requiredEnv("PR_NUMBER")),
      );

      await Promise.all(
        obsolete.map(async (deployment) => {
          try {
            await vercel({ method: "PATCH", path: `/v12/deployments/${deployment.uid}/cancel` });
          } catch (error) {
            const current = z
              .object({ readyState: z.string() })
              .parse(await vercel({ path: `/v13/deployments/${deployment.uid}` }));

            if (current.readyState !== "READY" && current.readyState !== "CANCELED") {
              throw error;
            }
          }

          process.stdout.write(`Stopped a ${project.app} build\n`);
        }),
      );

      if (pagination.next) {
        await cancelPage(String(pagination.next));
      }
    }

    await cancelPage();
  }

  await Promise.all(PROJECTS.map((project) => cancelProject(project)));
}

async function deployApp({
  project,
  target,
  apiUrl,
  appUrl,
  cache,
  mainAppUrl,
}: {
  project: Project;
  target: Target;
  apiUrl: string;
  appUrl: string;
  cache: CourseCacheAccess | null;
  mainAppUrl: string;
}): Promise<string> {
  if (target === "preview") {
    await assertPullRequestOpen();
  }

  const domain = target === "production" ? project.productionDomain : project.stagingDomain;

  const env = {
    DATABASE_URL: withVerifiedCertificate(requiredEnv("DATABASE_URL")),
    DATABASE_URL_UNPOOLED: requiredEnv("DATABASE_URL_UNPOOLED"),
    NEXT_PUBLIC_API_URL: target === "preview" && project.app === "api" ? "" : apiUrl,
    NEXT_PUBLIC_APP_DOMAIN: target === "preview" ? "" : domain,
    ...(project.app === "api" ? { MAIN_APP_URL: mainAppUrl } : {}),
    ...(cache && project.app !== "admin" ? { APP_CACHE_SECRET: cache.secret } : {}),
    ...(cache?.bypass && project.app === "api" ? { MAIN_CACHE_BYPASS_SECRET: cache.bypass } : {}),
  };

  const response = await vercel({
    body: {
      build: { env },
      env,
      gitSource: {
        ref: requiredEnv("DEPLOY_REF"),
        repoId: requiredEnv("GITHUB_REPOSITORY_ID"),
        sha: requiredEnv("DEPLOY_SHA"),
        type: "github",
      },
      meta: {
        ciCommitSha: requiredEnv("DEPLOY_SHA"),
        ciRunId: `${requiredEnv("GITHUB_RUN_ID")}-${requiredEnv("GITHUB_RUN_ATTEMPT")}`,
        ...(target === "preview" ? { ciPreviewPr: requiredEnv("PR_NUMBER") } : {}),
      },
      name: project.name,
      project: project.id,
      ...(target === "staging" ? { customEnvironmentSlugOrId: "staging" } : {}),
      ...(target === "production" ? { buildMachine: "turbo", target: "production" } : {}),
    },
    method: "POST",
    path: "/v13/deployments",
    query: { forceNew: "1", withCache: "1" },
  });

  const deployment = z.object({ id: z.string() }).parse(response);
  const url = await waitForDeployment({ app: project.app, id: deployment.id, target });

  if (target === "preview") {
    await vercel({
      body: { alias: new URL(appUrl).hostname },
      method: "POST",
      path: `/v2/deployments/${deployment.id}/aliases`,
    });
  }

  return url;
}

export async function waitForDeployment({
  app,
  id,
  target,
}: {
  app: string;
  id: string;
  target: Target;
}): Promise<string> {
  async function checkDeployment(): Promise<string | undefined> {
    if (target === "preview") {
      await assertPullRequestOpen();
    }

    const current = deploymentSchema.parse(await vercel({ path: `/v13/deployments/${id}` }));

    if (
      current.readyState === "ERROR" ||
      current.readyState === "CANCELED" ||
      current.readyState === "BLOCKED" ||
      current.aliasError
    ) {
      throw new Error(`Vercel ${app} deployment failed: ${current.readyState}`);
    }

    if (current.readyState === "READY" && (target === "preview" || current.aliasAssigned)) {
      return `https://${current.url}`;
    }

    return undefined;
  }

  const url = await waitFor({ check: checkDeployment, description: app });
  process.stdout.write(`${app}: ${url}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `- ${app}: ${url}\n`);
  }

  return url;
}

export async function deploy(target: Target): Promise<void> {
  const [teamSlug, cache] = await Promise.all([
    target === "preview" ? getTeamSlug() : "",
    target === "preview" ? getPreviewCacheAccess() : null,
  ]);

  const urlOf = (app: Project["app"]) => getAppUrl({ app, target, teamSlug });

  const results = await Promise.allSettled(
    PROJECTS.map((project) =>
      deployApp({
        apiUrl: urlOf("api"),
        appUrl: urlOf(project.app),
        cache,
        mainAppUrl: urlOf("main"),
        project,
        target,
      }),
    ),
  );

  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((result) => {
        const error: unknown = result.reason;
        return error;
      }),
      `${failures.length} ${target} deployment(s) failed`,
    );
  }
}

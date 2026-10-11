import { appendFile } from "node:fs/promises";
import { z } from "zod";
import { github, vercel, waitFor } from "./api.mts";
import { PROJECTS, requiredEnv } from "./config.mts";

type Target = "preview" | "staging" | "production";
type Project = (typeof PROJECTS)[number];

/** RFC 1035: Vercel shortens a longer generated label in a way its docs don't spell out. */
const MAX_DNS_LABEL = 63;

/**
 * The main app's address in a target, for the links the API builds (sign-in, the main app's own
 * pictures): its domain in production and staging, and on previews the branch URL Vercel gives
 * every project, `<project>-git-<branch>-<team>.vercel.app`. Null on a preview whose label Vercel
 * would shorten.
 */
export function getMainAppUrl({
  branch,
  target,
  teamSlug,
}: {
  branch: string;
  target: Target;
  teamSlug: string;
}): string | null {
  const main = PROJECTS.find((project) => project.app === "main");

  if (!main) {
    throw new Error("Missing the main app project");
  }

  if (target !== "preview") {
    return `https://${target === "production" ? main.productionDomain : main.stagingDomain}`;
  }

  const branchSlug = branch
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

  const label = `${main.name}-git-${branchSlug}-${teamSlug}`;

  return label.length > MAX_DNS_LABEL ? null : `https://${label}.vercel.app`;
}

/** The team's slug, which preview URLs end with. Null when Vercel doesn't answer. */
async function getTeamSlug(): Promise<string | null> {
  try {
    const team = z
      .object({ slug: z.string() })
      .parse(await vercel({ path: `/v2/teams/${requiredEnv("VERCEL_ORG_ID")}` }));

    return team.slug;
  } catch {
    return null;
  }
}

/** The main app's address for this deploy; a preview whose address can't be known gets none. */
async function resolveMainAppUrl(target: Target): Promise<string | null> {
  const teamSlug = target === "preview" ? await getTeamSlug() : "";

  if (teamSlug === null) {
    process.stdout.write("Unknown Vercel team slug: the API preview links to production\n");
    return null;
  }

  const url = getMainAppUrl({ branch: requiredEnv("DEPLOY_REF"), target, teamSlug });

  if (!url) {
    process.stdout.write(
      "Branch name too long for a predictable URL: the API preview links to production\n",
    );
  }

  return url;
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

export async function assertCurrentPreview(): Promise<void> {
  const pr = z
    .object({ head: z.object({ sha: z.string() }), state: z.string() })
    .parse(await github(`pulls/${requiredEnv("PR_NUMBER")}`));

  if (pr.state !== "open" || pr.head.sha !== requiredEnv("DEPLOY_SHA")) {
    throw new Error("This preview was superseded or its PR was closed");
  }
}

export async function cancelPreviews({ runId }: { runId?: string } = {}): Promise<void> {
  async function cancelProject(project: Project): Promise<void> {
    const query = { limit: "100", projectId: project.id, state: "QUEUED,INITIALIZING,BUILDING" };

    async function cancelPage(until?: string): Promise<void> {
      const { deployments, pagination } = deploymentPageSchema.parse(
        await vercel({ path: "/v6/deployments", query: { ...query, ...(until ? { until } : {}) } }),
      );

      const obsolete = deployments.filter(
        (deployment) =>
          deployment.target !== "production" &&
          deployment.meta?.ciPreviewPr === requiredEnv("PR_NUMBER") &&
          (!runId || deployment.meta.ciRunId === runId),
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

          process.stdout.write(`Stopped superseded ${project.app} preview build\n`);
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
  mainAppUrl,
}: {
  project: Project;
  target: Target;
  apiUrl: string;
  mainAppUrl: string | null;
}): Promise<string> {
  if (target === "preview") {
    await assertCurrentPreview();
  }

  const domain = target === "production" ? project.productionDomain : project.stagingDomain;

  const env = {
    DATABASE_URL: requiredEnv("DATABASE_URL"),
    DATABASE_URL_UNPOOLED: requiredEnv("DATABASE_URL_UNPOOLED"),
    NEXT_PUBLIC_API_URL: target === "preview" && project.app === "api" ? "" : apiUrl,
    NEXT_PUBLIC_APP_DOMAIN: target === "preview" ? "" : domain,
    ...(project.app === "api" ? { NEXT_PUBLIC_AUTH_BASE_PATH: "/v1/auth" } : {}),
    ...(project.app === "api" && mainAppUrl ? { MAIN_APP_URL: mainAppUrl } : {}),
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
    query: { forceNew: "1" },
  });

  const deployment = z.object({ id: z.string() }).parse(response);

  async function checkDeployment(): Promise<string | undefined> {
    if (target === "preview") {
      await assertCurrentPreview();
    }

    const current = deploymentSchema.parse(
      await vercel({ path: `/v13/deployments/${deployment.id}` }),
    );

    if (
      current.readyState === "ERROR" ||
      current.readyState === "CANCELED" ||
      current.readyState === "BLOCKED" ||
      current.aliasError
    ) {
      throw new Error(`Vercel ${project.app} deployment failed: ${current.readyState}`);
    }

    if (current.readyState === "READY" && (target === "preview" || current.aliasAssigned)) {
      return `https://${current.url}`;
    }

    return undefined;
  }

  const url = await waitFor({ check: checkDeployment, description: project.app });
  process.stdout.write(`${project.app}: ${url}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `- ${project.app}: ${url}\n`);
  }

  return url;
}

export async function deploy(target: Target): Promise<void> {
  const [api, ...clients] = PROJECTS;
  const mainAppUrl = await resolveMainAppUrl(target);

  if (target === "preview") {
    const apiUrl = await deployApp({
      apiUrl: "https://api.zoonk.dev",
      mainAppUrl,
      project: api,
      target,
    });

    await Promise.all(clients.map((project) => deployApp({ apiUrl, mainAppUrl, project, target })));
    return;
  }

  const apiUrl = target === "production" ? "https://api.zoonk.com" : "https://api.zoonk.dev";
  // Wait for every result: a failed app must not hide the status of the other builds.
  const results = await Promise.allSettled(
    PROJECTS.map((project) => deployApp({ apiUrl, mainAppUrl, project, target })),
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

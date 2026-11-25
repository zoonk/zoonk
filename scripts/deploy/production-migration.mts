import { z } from "zod";
import { vercel } from "./api.mts";
import { PROJECTS, requiredEnv } from "./config.mts";

const servedDeploymentSchema = z.object({
  createdAt: z.number(),
  id: z.string(),
  meta: z.object({ githubCommitSha: z.string() }),
});

/**
 * A migration must leave only the release still running to keep compatible. Apps go live one by
 * one, so a failed release can leave an app behind, and Skew Protection keeps sending an open tab
 * to the deployment that served it for the project's whole maximum age. Throws, before anything
 * changes, while the apps run different releases.
 */
export async function prepareProductionMigration(): Promise<void> {
  const served = await Promise.all(
    PROJECTS.map(async (project) => ({
      deployment: servedDeploymentSchema.parse(
        await vercel({ path: `/v13/deployments/${project.productionDomain}` }),
      ),
      project,
    })),
  );

  const behind = served.filter(
    ({ deployment }) => deployment.meta.githubCommitSha !== requiredEnv("DEPLOY_SHA"),
  );

  if (new Set(behind.map(({ deployment }) => deployment.meta.githubCommitSha)).size > 1) {
    const releases = behind
      .map(({ deployment, project }) => `${project.app} ${deployment.meta.githubCommitSha}`)
      .join(", ");

    throw new Error(
      `Production runs more than one release (${releases}); deploy the last release to every app before migrating`,
    );
  }

  await Promise.all(
    served.map(async ({ deployment, project }) => {
      await vercel({
        body: { skewProtectionBoundaryAt: deployment.createdAt },
        method: "PATCH",
        path: `/v9/projects/${project.id}`,
      });

      process.stdout.write(`${project.app}: open tabs reach ${deployment.id} or newer\n`);
    }),
  );
}

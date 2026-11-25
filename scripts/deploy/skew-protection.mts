import { z } from "zod";
import { vercel } from "./api.mts";
import { PROJECTS } from "./config.mts";

const runningDeploymentSchema = z.object({ createdAt: z.number(), id: z.string() });

/**
 * Skew Protection sends an open tab's requests to the deployment that served the tab for the
 * project's whole maximum age, so an older release would meet the schema this release migrates to.
 */
export async function limitSkewProtectionToRunningRelease(): Promise<void> {
  await Promise.all(
    PROJECTS.map(async (project) => {
      const running = runningDeploymentSchema.parse(
        await vercel({ path: `/v13/deployments/${project.productionDomain}` }),
      );

      await vercel({
        body: { skewProtectionBoundaryAt: running.createdAt },
        method: "PATCH",
        path: `/v9/projects/${project.id}`,
      });

      process.stdout.write(`${project.app}: open tabs reach ${running.id} or newer\n`);
    }),
  );
}

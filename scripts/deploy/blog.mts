import { z } from "zod";
import { vercel } from "./api.mts";
import { requiredEnv } from "./config.mts";
import { waitForDeployment } from "./deployment.mts";

export async function deployBlog(): Promise<void> {
  const response = await vercel({
    body: {
      gitSource: {
        ref: requiredEnv("DEPLOY_REF"),
        repoId: requiredEnv("GITHUB_REPOSITORY_ID"),
        sha: requiredEnv("DEPLOY_SHA"),
        type: "github",
      },
      name: "zoonk-blog",
      project: requiredEnv("VERCEL_PROJECT_ID_BLOG"),
      target: "production",
    },
    method: "POST",
    path: "/v13/deployments",
    query: { forceNew: "1", withCache: "1" },
  });

  const deployment = z.object({ id: z.string() }).parse(response);
  await waitForDeployment({ app: "blog", id: deployment.id, target: "production" });
}

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { BaseBuilder, createBaseBuilderConfig } from "@workflow/builders";

/** Where `@workflow/vitest` looks for the bundle by default. */
const OUT_DIR = join(import.meta.dirname, ".workflow-vitest");

/**
 * Workspace packages stay imports so steps share the test's copy: its `vi.mock` reaches them, and an
 * inlined `@zoonk/db`'s `sql` fragments would fail the test's Prisma `instanceof Sql`. Inlined, they
 * also pull every package they use into a 21 MB bundle that Vite is slow to transform.
 */
class ApiWorkflowTestBuilder extends BaseBuilder {
  constructor() {
    super({
      ...createBaseBuilderConfig({
        dirs: ["src"],
        externalPackages: ["@zoonk/*"],
        workingDir: import.meta.dirname,
      }),
      buildTarget: "next",
      suppressCreateManifestLogs: true,
      suppressCreateWebhookBundleLogs: true,
      suppressCreateWorkflowsBundleLogs: true,
    });
  }

  async build() {
    await mkdir(OUT_DIR, { recursive: true });
    const inputFiles = await this.getInputFiles();

    await this.createCombinedBundle({
      bundleFinalOutput: false,
      bundleTransitiveLocalStepDependencies: true,
      externalizeNonSteps: true,
      flowOutfile: join(OUT_DIR, "combined.mjs"),
      format: "esm",
      inputFiles: inputFiles.filter((file) => file.endsWith(".integration.test.ts")),
      stepsOutfile: join(OUT_DIR, "__step_registrations.mjs"),
    });
  }
}

export default async function setup() {
  await new ApiWorkflowTestBuilder().build();
}

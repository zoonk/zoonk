import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { BaseBuilder, createBaseBuilderConfig } from "@workflow/builders";

/** Where `@workflow/vitest` looks for the bundle by default. */
const OUT_DIR = join(import.meta.dirname, ".workflow-vitest");

/**
 * The bundle `@workflow/vitest` builds, with one difference: `@zoonk/ai` stays an import instead of
 * being inlined with the other workspace packages, so a test's `vi.mock` replaces the provider and
 * the review models while the steps run real core against the test database.
 */
class ApiWorkflowTestBuilder extends BaseBuilder {
  constructor() {
    super({
      ...createBaseBuilderConfig({
        dirs: ["src/workflows"],
        externalPackages: ["@zoonk/ai"],
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

    await this.createCombinedBundle({
      bundleFinalOutput: false,
      bundleTransitiveLocalStepDependencies: true,
      externalizeNonSteps: true,
      flowOutfile: join(OUT_DIR, "combined.mjs"),
      format: "esm",
      inputFiles: await this.getInputFiles(),
      stepsOutfile: join(OUT_DIR, "__step_registrations.mjs"),
    });
  }
}

export default async function setup() {
  await new ApiWorkflowTestBuilder().build();
}

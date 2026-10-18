import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { type TestProject } from "vitest/node";
import { NestLocalBuilder } from "workflow/nest/builder";
import { z } from "zod";

declare module "vitest" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest requires interface merging for its provided context.
  export interface ProvidedContext {
    liveCallRuntime: { flowPath: string; root: string; workflowId: string };
  }
}

const apiDirectory = resolve(import.meta.dirname, "..");
const repositoryDirectory = resolve(apiDirectory, "../..");

const manifestSchema = z.object({
  workflows: z.record(z.string(), z.record(z.string(), z.object({ workflowId: z.string() }))),
});

/** The published standalone builder emits the actual production workflow and registered steps. */
class LiveCallRuntimeBuilder extends NestLocalBuilder {
  constructor(root: string) {
    super({
      dirs: [resolve(apiDirectory, "src/workflows/v2/calls")],
      outDir: resolve(root, "bundles"),
      sourcemap: false,
      workingDir: root,
    });

    this.config = {
      ...this.config,
      // Vitest replaces the external AI leaf; core and Prisma remain their real implementations.
      externalPackages: ["@zoonk/ai", "@zoonk/db", "next/cache"],
      // Workspace imports retain their canonical identities even though all output is temporary.
      moduleSpecifierRoot: repositoryDirectory,
      projectRoot: repositoryDirectory,
    };
  }
}

export default async function setup(project: TestProject) {
  const root = await mkdtemp(resolve(tmpdir(), "zoonk-live-call-workflow-"));
  // Generated modules resolve installed public packages without installing dependencies.
  await symlink(resolve(apiDirectory, "node_modules"), resolve(root, "node_modules"), "dir");

  try {
    const builder = new LiveCallRuntimeBuilder(root);
    await builder.build();

    const manifest = manifestSchema.parse(
      JSON.parse(await readFile(resolve(builder.outDir, "manifest.json"), "utf8")),
    );

    const references = Object.values(manifest.workflows).flatMap((entries) =>
      Object.entries(entries).filter(([name]) => name === "liveCallDeadlineWorkflow"),
    );

    const reference = references[0];

    if (references.length !== 1 || !reference) {
      throw new Error("The runtime build must contain one production liveCallDeadlineWorkflow.");
    }

    project.provide("liveCallRuntime", {
      flowPath: resolve(builder.outDir, "workflows.mjs"),
      root,
      workflowId: reference[1].workflowId,
    });

    return () => rm(root, { force: true, recursive: true });
  } catch (error) {
    await rm(root, { force: true, recursive: true });
    throw error;
  }
}

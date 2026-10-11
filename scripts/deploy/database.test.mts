import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cli = vi.hoisted(() => ({ commands: [] as string[][] }));

// The provider CLI is an external boundary; never launch it against a live database in tests.
vi.mock("node:child_process", () => ({
  execFile: (
    _file: string,
    args: string[],
    _options: unknown,
    callback: (error: Error | null, stdout: string) => void,
  ) => {
    cli.commands.push(args);
    const branch = args[2];

    callback(
      null,
      `postgresql://app_owner:password@${branch}/app?pooled=${args.includes("--pooled")}`,
    );
  },
}));

const directory = await mkdtemp(join(tmpdir(), "zoonk-deploy-test-"));
const environmentFile = join(directory, "environment");

describe("Deployment database selection", () => {
  beforeEach(async () => {
    vi.resetModules();
    cli.commands.length = 0;
    vi.stubEnv("NEON_API_KEY", "test-neon-key");
    vi.stubEnv("NEON_PROJECT_ID", "test-project");
    vi.stubEnv("NEON_PRODUCTION_BRANCH", "production");
    vi.stubEnv("NEON_STAGING_BRANCH", "staging");
    vi.stubEnv("NEON_DATABASE", "app");
    vi.stubEnv("NEON_ROLE", "app_owner");
    vi.stubEnv("GITHUB_ENV", environmentFile);
    await writeFile(environmentFile, "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await rm(directory, { recursive: true });
  });

  it.each(["staging", "production"])("selects the explicit %s database", async (target) => {
    vi.stubEnv("DEPLOY_TARGET", target);
    // Never retrieve live database credentials in tests; Neon is the external boundary.
    vi.stubGlobal("fetch", (url: URL) => {
      if (url.pathname.endsWith("/branches")) {
        return Promise.resolve(
          Response.json({
            branches: [
              { id: "br-production", name: "production" },
              { id: "br-staging", name: "staging" },
            ],
          }),
        );
      }

      throw new Error("Connection strings should come from the official CLI");
    });

    await import("./database.mts");
    expect(cli.commands).toHaveLength(2);

    expect(cli.commands.map((args) => args[2])).toStrictEqual([`br-${target}`, `br-${target}`]);

    await expect(readFile(environmentFile, "utf8")).resolves.toBe(
      `DATABASE_URL=postgresql://app_owner:password@br-${target}/app?pooled=true\nDATABASE_URL_UNPOOLED=postgresql://app_owner:password@br-${target}/app?pooled=false\n`,
    );
  });

  it("lets the CLI discover the preview parent's database and role when no overrides are supplied", async () => {
    vi.stubEnv("DEPLOY_TARGET", "preview");
    vi.stubEnv("NEON_PRODUCTION_BRANCH", "");
    delete process.env.NEON_STAGING_BRANCH;
    vi.stubEnv("NEON_DATABASE", "");
    vi.stubEnv("NEON_ROLE", "");

    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        Response.json({
          branches: [
            { id: "br-production", name: "production" },
            { id: "br-staging", name: "staging" },
          ],
        }),
      ),
    );

    await import("./database.mts");
    expect(cli.commands).toHaveLength(1);
    expect(cli.commands[0]).not.toContain("--database-name");
    expect(cli.commands[0]).not.toContain("--role-name");

    await expect(readFile(environmentFile, "utf8")).resolves.toBe(
      "NEON_PARENT_BRANCH=br-staging\nNEON_DATABASE=app\nNEON_ROLE=app_owner\n",
    );
  });

  it("uses configured branch names instead of the defaults", async () => {
    vi.stubEnv("DEPLOY_TARGET", "production");
    vi.stubEnv("NEON_PRODUCTION_BRANCH", "live");
    vi.stubEnv("NEON_STAGING_BRANCH", "canary");

    vi.stubGlobal("fetch", (url: URL) => {
      const selector = url.searchParams.get("search");

      return Promise.resolve(
        Response.json({ branches: [{ id: `br-${selector}`, name: selector }] }),
      );
    });

    await import("./database.mts");
    expect(cli.commands.map((args) => args[2])).toStrictEqual(["br-live", "br-live"]);
  });

  it("rejects production and staging aliases that resolve to the same branch ID", async () => {
    vi.stubEnv("DEPLOY_TARGET", "staging");
    vi.stubEnv("NEON_STAGING_BRANCH", "br-production");

    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ branches: [{ id: "br-production", name: "production" }] })),
    );

    await expect(import("./database.mts")).rejects.toThrow("different Neon branches");
    await expect(readFile(environmentFile, "utf8")).resolves.toBe("");
  });
});

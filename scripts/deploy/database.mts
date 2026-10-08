import { execFile } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { requiredEnv } from "./config.mts";
import { findBranch } from "./neon.mts";

const target = requiredEnv("DEPLOY_TARGET");

if (target !== "staging" && target !== "production" && target !== "preview") {
  throw new Error("Database credentials require an explicit deployment target");
}

const productionBranch = process.env.NEON_PRODUCTION_BRANCH || "production";
const stagingBranch = process.env.NEON_STAGING_BRANCH || "staging";

const [production, staging] = await Promise.all([
  findBranch(productionBranch),
  findBranch(stagingBranch),
]);

if (!production || !staging) {
  throw new Error("Selected staging and production Neon branches must exist");
}

if (production.id === staging.id) {
  throw new Error("Staging and production must use different Neon branches");
}

const branchId = target === "production" ? production.id : staging.id;

async function connectionUri(pooled: boolean): Promise<string> {
  requiredEnv("NEON_API_KEY");

  const args = [
    fileURLToPath(import.meta.resolve("neonctl/cli.js")),
    "connection-string",
    branchId,
    "--project-id",
    requiredEnv("NEON_PROJECT_ID"),
    "--endpoint-type",
    "read_write",
    ...(pooled ? ["--pooled"] : []),
    ...(process.env.NEON_DATABASE ? ["--database-name", process.env.NEON_DATABASE] : []),
    ...(process.env.NEON_ROLE ? ["--role-name", process.env.NEON_ROLE] : []),
  ];

  const uri = await new Promise<string>((resolve, reject) => {
    execFile(process.execPath, args, { timeout: 60_000 }, (error, stdout) => {
      if (error) {
        // CLI output may contain credentials. Do not include it in the error.
        reject(
          new Error(
            "Neon CLI failed; set NEON_DATABASE/NEON_ROLE if the branch has multiple choices",
          ),
        );

        return;
      }

      resolve(stdout.trim());
    });
  });

  if (!uri || /[\r\n]/u.test(uri)) {
    throw new Error("Invalid Neon connection URI");
  }

  process.stdout.write(`::add-mask::${uri}\n`);

  if (!URL.canParse(uri) || new URL(uri).protocol !== "postgresql:") {
    throw new Error("Invalid Neon connection URI");
  }

  return uri;
}

if (target === "preview") {
  const uri = new URL(await connectionUri(false));
  const database = decodeURIComponent(uri.pathname.slice(1));
  const role = decodeURIComponent(uri.username);

  if (!database || !role || /[\r\n]/u.test(database + role)) {
    throw new Error("Invalid Neon database or role");
  }

  await appendFile(
    requiredEnv("GITHUB_ENV"),
    `NEON_PARENT_BRANCH=${staging.id}\nNEON_DATABASE=${database}\nNEON_ROLE=${role}\n`,
  );
} else {
  const [pooled, direct] = await Promise.all([connectionUri(true), connectionUri(false)]);

  await appendFile(
    requiredEnv("GITHUB_ENV"),
    `DATABASE_URL=${pooled}\nDATABASE_URL_UNPOOLED=${direct}\n`,
  );

  process.stdout.write(`Using the selected ${target} Neon branch\n`);
}

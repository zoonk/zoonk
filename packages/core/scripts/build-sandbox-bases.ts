import { logInfo } from "@zoonk/utils/logger";
import {
  buildSandboxBase,
  smokeSandboxFork,
} from "../src/library/activities/programs/build-sandbox-base";
import { SANDBOX_LANGUAGE_IDS } from "../src/library/activities/programs/program-languages";
import { sandboxLanguageSchema } from "../src/library/activities/programs/sandbox-contract";

const args = process.argv.slice(2);

const languages = args
  .filter((arg) => arg !== "--verify-fork")
  .map((arg) => sandboxLanguageSchema.parse(arg));

const selected = languages.length === 0 ? SANDBOX_LANGUAGE_IDS : languages;

const {
  VERCEL_ORG_ID: teamId,
  VERCEL_PROJECT_ID_API: projectId,
  VERCEL_TOKEN: token,
} = process.env;

if ([teamId, projectId, token].some(Boolean) && !(teamId && projectId && token)) {
  throw new Error(
    "Set VERCEL_ORG_ID, VERCEL_PROJECT_ID_API and VERCEL_TOKEN together, or use the API project's OIDC",
  );
}

const options = teamId && projectId && token ? { projectId, teamId, token } : undefined;

const builds = await Promise.allSettled(
  selected.map(async (language) => {
    const began = performance.now();
    await buildSandboxBase({ language, options });

    if (args.includes("--verify-fork")) {
      await smokeSandboxFork({ language, options });
    }

    logInfo(`${language} base ready in ${Math.round(performance.now() - began)} ms`);
  }),
);

const failures: unknown[] = builds.flatMap((build) =>
  build.status === "rejected" ? [build.reason as unknown] : [],
);

if (failures.length > 0) {
  throw new AggregateError(failures, "Some sandbox bases failed to build");
}

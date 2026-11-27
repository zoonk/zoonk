import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getSessionCookieName } from "@zoonk/auth/cookies";
import { createOpenAPIDocument } from "../src/lib/openapi/create-document";
import { prepareNativeEnums } from "./native-enum-tags";

/** The native clients generate their API code from these copies of the contract. */
const OPENAPI_ARTIFACT_PATHS = {
  android: resolve(import.meta.dirname, "../../android/api/openapi.json"),
  apple: resolve(import.meta.dirname, "../../apple/ZoonkAPI/Sources/ZoonkAPI/openapi.json"),
};

function serializeOpenAPIDocument(platform: keyof typeof OPENAPI_ARTIFACT_PATHS) {
  const document = createOpenAPIDocument({
    cookieName: getSessionCookieName({ secure: true }),
    openapi: "3.0.3",
  });

  prepareNativeEnums(document, platform);
  return `${JSON.stringify(document, null, 2)}\n`;
}

async function checkOpenAPIArtifact(path: string, expected: string) {
  const current = await readFile(path, "utf8").catch(() => null);

  if (current !== expected) {
    throw new Error(`OpenAPI artifact ${path} is stale. Run pnpm openapi:generate.`);
  }
}

async function main() {
  await Promise.all(
    (["apple", "android"] as const).map(async (platform) => {
      const document = serializeOpenAPIDocument(platform);
      const path = OPENAPI_ARTIFACT_PATHS[platform];

      if (process.argv.includes("--check")) {
        await checkOpenAPIArtifact(path, document);
      } else {
        await writeFile(path, document);
      }
    }),
  );
}

await main();

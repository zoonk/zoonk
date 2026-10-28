import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getSessionCookieName } from "@zoonk/auth/cookies";
import { createOpenAPIDocument } from "../src/lib/openapi/create-document";

/** The native clients generate their API code from these copies of the contract. */
const OPENAPI_ARTIFACT_PATHS = [
  resolve(import.meta.dirname, "../../apple/ZoonkAPI/Sources/ZoonkAPI/openapi.json"),
  resolve(import.meta.dirname, "../../android/api/openapi.json"),
];

function serializeOpenAPIDocument() {
  const document = createOpenAPIDocument({
    cookieName: getSessionCookieName({ secure: true }),
    openapi: "3.0.3",
  });

  return `${JSON.stringify(document, null, 2)}\n`;
}

async function checkOpenAPIArtifact(path: string, expected: string) {
  const current = await readFile(path, "utf8").catch(() => null);

  if (current !== expected) {
    throw new Error(`OpenAPI artifact ${path} is stale. Run pnpm openapi:generate.`);
  }
}

async function main() {
  const document = serializeOpenAPIDocument();

  if (process.argv.includes("--check")) {
    await Promise.all(OPENAPI_ARTIFACT_PATHS.map((path) => checkOpenAPIArtifact(path, document)));
    return;
  }

  await Promise.all(OPENAPI_ARTIFACT_PATHS.map((path) => writeFile(path, document)));
}

await main();

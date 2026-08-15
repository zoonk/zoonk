import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getSessionCookieName } from "@zoonk/auth/cookies";
import { createOpenAPIDocument } from "../src/lib/openapi/create-document";

const SWIFT_OPENAPI_ARTIFACT_PATH = resolve(import.meta.dirname, "../../apple/Zoonk/openapi.json");

function serializeOpenAPIDocument() {
  const document = createOpenAPIDocument({
    cookieName: getSessionCookieName({ secure: true }),
    openapi: "3.0.3",
  });

  return `${JSON.stringify(document, null, 2)}\n`;
}

async function checkOpenAPIArtifact(expected: string) {
  const current = await readFile(SWIFT_OPENAPI_ARTIFACT_PATH, "utf8").catch(() => null);

  if (current !== expected) {
    throw new Error("OpenAPI artifact is stale. Run pnpm openapi:generate.");
  }
}

async function main() {
  const document = serializeOpenAPIDocument();

  if (process.argv.includes("--check")) {
    await checkOpenAPIArtifact(document);
    return;
  }

  await writeFile(SWIFT_OPENAPI_ARTIFACT_PATH, document);
}

await main();

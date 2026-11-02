/**
 * Writes the Android code sandbox's page from main's player sandbox. Run it whenever main's sandbox
 * changes (`sandbox-html.test.mts` fails until you do): `pnpm --filter android sandbox`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SANDBOX_PAGE_FILE, sandboxPage } from "./sandbox-html.mts";

mkdirSync(dirname(SANDBOX_PAGE_FILE), { recursive: true });
writeFileSync(SANDBOX_PAGE_FILE, await sandboxPage());

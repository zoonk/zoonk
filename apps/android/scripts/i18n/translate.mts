import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { ANDROID_ROOT } from "./catalogs.mts";
import { synchronizeCatalogs } from "./synchronize-catalogs.mts";

execFileSync(process.execPath, [fileURLToPath(new URL("check-catalogs.mts", import.meta.url))], {
  stdio: "inherit",
});

const translationArguments = process.argv.slice(2);

execFileSync("eloqnt", ["translate", ...translationArguments], {
  cwd: ANDROID_ROOT,
  stdio: "inherit",
});

const isHelp = translationArguments.includes("--help") || translationArguments.includes("-h");

if (!isHelp) {
  await synchronizeCatalogs({ locales: SUPPORTED_LOCALES, root: ANDROID_ROOT });
  execFileSync("eloqnt", ["lint", "--strict"], { cwd: ANDROID_ROOT, stdio: "inherit" });
}

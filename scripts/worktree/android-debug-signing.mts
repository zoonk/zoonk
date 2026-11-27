import { spawnSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";

const VARIABLE = "ANDROID_DEBUG_CERT_FINGERPRINTS";
const OVERRIDES = [".env.local", ".env.development.local", ".env.production.local"];

function debugFingerprint() {
  const androidUserHome =
    process.env.ANDROID_USER_HOME || join(process.env.ANDROID_SDK_HOME || homedir(), ".android");

  const keystore = join(androidUserHome, "debug.keystore");

  if (!existsSync(keystore)) {
    return;
  }

  const keytool = process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "keytool.exe" : "keytool")
    : "keytool";

  const certificate = spawnSync(
    keytool,
    ["-exportcert", "-keystore", keystore, "-alias", "androiddebugkey", "-storepass", "android"],
    { timeout: 5000 },
  );

  if (certificate.status === 0) {
    return new X509Certificate(certificate.stdout).fingerprint256;
  }
}

function readEnvironment(file: string) {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

export function configureAndroidDebugSigning(worktree: string): void {
  if (process.env.CI || process.env[VARIABLE]?.trim()) {
    return;
  }

  const fingerprint = debugFingerprint();

  if (!fingerprint) {
    return;
  }

  for (const app of ["api", "main"]) {
    const directory = join(worktree, "apps", app);
    const file = join(directory, ".env");
    const content = readEnvironment(file);

    const configured =
      parseEnv(content)[VARIABLE]?.trim() ||
      OVERRIDES.some((name) => parseEnv(readEnvironment(join(directory, name)))[VARIABLE]?.trim());

    if (!configured) {
      // Keep the original dotenv document intact, including multiline credentials and comments.
      const separator = content && !content.endsWith("\n") ? "\n" : "";
      writeFileSync(file, `${content}${separator}${VARIABLE}=${fingerprint}\n`, { mode: 0o600 });
    }
  }
}

import "server-only";
import { randomUUID } from "node:crypto";
import { safeAsync } from "@zoonk/utils/error";
import { executeSandboxProgram } from "./execute-sandbox-program";
import { type SandboxLanguage } from "./program-languages";
import {
  type ProgramSandbox,
  type SandboxOptions,
  createSandboxDriver,
  sandboxBase,
} from "./sandbox-driver";
import { SANDBOX_TOOLCHAINS, runBudgetMs } from "./sandbox-languages";
import { SANDBOX_WRAPPER, SANDBOX_WRAPPER_PATH } from "./sandbox-wrapper";

function installScript(language: SandboxLanguage) {
  const { install } = SANDBOX_TOOLCHAINS[language];

  return `
. /etc/os-release
test "$VERSION_ID" = '26.04'
${install}
id learner >/dev/null 2>&1 || useradd --create-home --user-group --shell /usr/sbin/nologin learner
install -d -o root -g root -m 0711 /var/tmp/zoonk-code
cat > '${SANDBOX_WRAPPER_PATH}' <<'ZOONK_WRAPPER'
${SANDBOX_WRAPPER}
ZOONK_WRAPPER
chmod 0755 '${SANDBOX_WRAPPER_PATH}'
`;
}

async function smokePrograms({
  language,
  sandbox,
}: {
  language: SandboxLanguage;
  sandbox: ProgramSandbox;
}) {
  const { hello, invalid } = SANDBOX_TOOLCHAINS[language].smoke;
  const good = await executeSandboxProgram({ code: hello, language, runId: randomUUID(), sandbox });

  if (good.stop !== "done" || good.output.trim() !== "hello") {
    throw new Error(`${language} hello smoke failed (${good.stop}): ${good.errorOutput}`);
  }

  const bad = await executeSandboxProgram({
    code: invalid,
    language,
    runId: randomUUID(),
    sandbox,
  });

  if (bad.stop !== "error" || !bad.error?.line) {
    throw new Error(`${language} syntax smoke failed (${bad.stop}): ${bad.errorOutput}`);
  }
}

export async function buildSandboxBase({
  language,
  options,
}: {
  language: SandboxLanguage;
  options?: SandboxOptions;
}) {
  const base = await sandboxBase({ language, options });

  if (base.alreadyBuilt) {
    return;
  }

  try {
    const sandbox = await base.install(installScript(language));
    await smokePrograms({ language, sandbox });
    await base.seal();
  } catch (error) {
    await safeAsync(() => base.stop());
    throw error;
  }
}

export async function smokeSandboxFork({
  language,
  options,
}: {
  language: SandboxLanguage;
  options?: SandboxOptions;
}) {
  const name = `check-${randomUUID()}`;

  const sandbox = await createSandboxDriver(options).fork({
    language,
    name,
    timeoutMs: 2 * runBudgetMs(language),
  });

  try {
    await smokePrograms({ language, sandbox });
  } finally {
    await sandbox.stop();
  }
}

import "server-only";
import { randomUUID } from "node:crypto";
import { safeAsync } from "@zoonk/utils/error";
import { executeSandboxProgram } from "./execute-sandbox-program";
import { type SandboxLanguage } from "./program-languages";
import { baseRecipe } from "./sandbox-bases";
import {
  type ProgramSandbox,
  type SandboxOptions,
  createSandboxDriver,
  sandboxBase,
} from "./sandbox-driver";
import { SANDBOX_TOOLCHAINS, runBudgetMs } from "./sandbox-languages";
import { SANDBOX_STAGING_DIR, SANDBOX_WRAPPER_PATH } from "./sandbox-wrapper";

const EXPECTED_SETUID = [
  "/usr/bin/chfn",
  "/usr/bin/chsh",
  "/usr/bin/gpasswd",
  "/usr/bin/mount",
  "/usr/bin/passwd",
  "/usr/bin/su",
  "/usr/bin/sudo.ws",
  "/usr/bin/umount",
].join(" ");

const CHECK_SECONDS = 20;
const CHECK_OUTPUT_BYTES = 65_536;
const TIMED_OUT = 137;

/** Run as the learner through the wrapper; prints each way out it finds and fails if there is one. */
const ISOLATION_CHECK = `
run=$1
failures=()
sudo -n true >/dev/null 2>&1 && failures+=("sudo runs")
for target in /vercel/sandbox ${SANDBOX_STAGING_DIR} "${SANDBOX_STAGING_DIR}/$run" /usr/local/bin /opt /usr /usr/bin; do
  if (: > "$target/.zoonk-isolation") 2>/dev/null; then
    failures+=("writes $target")
    rm -f "$target/.zoonk-isolation"
  fi
done
[[ -w ${SANDBOX_WRAPPER_PATH} ]] && failures+=("writes the wrapper")
setuid=$(find / \\( -path /proc -o -path /sys \\) -prune -o -perm -4000 -type f -print 2>/dev/null | sort | paste -sd ' ')
[[ "$setuid" == "${EXPECTED_SETUID}" ]] || failures+=("setuid binaries are: $setuid")
timeout 3 bash -c ': > /dev/tcp/1.1.1.1/443' 2>/dev/null && failures+=("connects out")
printf '%s\\n' "\${failures[@]}"
(( \${#failures[@]} == 0 ))
`;

/** A learner in a real fork can't escalate, change what runs them, or reach the network, and a run past its limit times out. */
async function checkIsolation({
  language,
  sandbox,
}: {
  language: SandboxLanguage;
  sandbox: ProgramSandbox;
}) {
  const runId = randomUUID();
  const staged = `${SANDBOX_STAGING_DIR}/${runId}`;
  const wrapper = (args: string[]) => sandbox.run({ args, cmd: SANDBOX_WRAPPER_PATH, sudo: true });
  const cap = String(CHECK_OUTPUT_BYTES);

  await sandbox.write([{ content: ISOLATION_CHECK, path: `${staged}/isolation.sh` }]);

  try {
    if ((await wrapper(["prepare", runId, "isolation.sh"])) !== 0) {
      throw new Error(`${language} isolation check could not start`);
    }

    if (
      (await wrapper(["run", runId, String(CHECK_SECONDS), cap, "bash", "isolation.sh", runId])) !==
      0
    ) {
      const found = await sandbox.read(`${staged}/run.stdout`);
      throw new Error(`${language} fork lets the learner out: ${found}`);
    }

    const looping = await wrapper([
      "compile",
      runId,
      "1",
      cap,
      "bash",
      "-c",
      "while :; do :; done",
    ]);

    if (looping !== TIMED_OUT) {
      throw new Error(
        `${language} fork reported a run past its limit as ${looping}, not a time-out`,
      );
    }
  } finally {
    await wrapper(["clean", runId]);
  }
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
    const sandbox = await base.install(baseRecipe(language));
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
    await checkIsolation({ language, sandbox });
  } finally {
    await sandbox.stop();
  }
}

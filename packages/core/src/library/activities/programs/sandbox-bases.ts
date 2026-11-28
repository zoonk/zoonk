import "server-only";
import { createHash } from "node:crypto";
import { type SandboxLanguage } from "./program-languages";
import { SANDBOX_TOOLCHAINS } from "./sandbox-languages";
import { SANDBOX_WRAPPER, SANDBOX_WRAPPER_PATH } from "./sandbox-wrapper";

const HASH_LENGTH = 12;

/** Installs the toolchain, the unprivileged learner and the wrapper every run goes through. */
export function baseRecipe(language: SandboxLanguage) {
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

/**
 * Named by what the build puts in it: the recipe and the programs that warm its caches. A changed
 * recipe builds a new base, so a preview never forks one another release still uses.
 */
function contentHash(language: SandboxLanguage) {
  const { compile, files, run, smoke } = SANDBOX_TOOLCHAINS[language];

  return createHash("sha256")
    .update(baseRecipe(language))
    .update(JSON.stringify({ compile, files, run, smoke }))
    .digest("hex")
    .slice(0, HASH_LENGTH);
}

export function sandboxBaseName(language: SandboxLanguage) {
  return `code-${language}-${contentHash(language)}`;
}

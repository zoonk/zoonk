import { fileURLToPath } from "node:url";
import { defineConfig } from "@eloqnt/cli";
import { codexCli } from "ai-sdk-provider-codex-cli";

type EloqntMessages = Parameters<typeof defineConfig>[0]["messages"];

type EloqntProjectOptions = {
  messages?: Partial<EloqntMessages>;
  srcPath?: string | string[] | null;
};

/** Runs a trusted Codex CLI from outside the repo, not the optional binary the provider can install under node_modules. */
function getCodexPath() {
  return process.env.CODEX_PATH ?? "codex";
}

function getSrcPath(srcPath: EloqntProjectOptions["srcPath"]) {
  if (srcPath === null) {
    return;
  }

  return srcPath ?? "./src";
}

/** @public */
export default function defineEloqntConfig(options: EloqntProjectOptions = {}) {
  return defineConfig({
    messages: {
      format: "po",
      locales: "infer",
      path: "./messages",
      sourceLocale: "en",
      ...options.messages,
    },
    // Luna rather than Sol at xhigh, which ranked best in a blind read: translation runs thousands of
    // times a week on the Codex subscription, and its cost matters more than a slightly better string.
    model: codexCli("gpt-6-luna", {
      codexPath: getCodexPath(),
      // Codex otherwise sends AGENTS.md, memories, the skills list and agent context with every
      // request, about 80% of each translation's input.
      configOverrides: {
        "features.memories": false,
        include_apps_instructions: false,
        include_collaboration_mode_instructions: false,
        include_environment_context: false,
        include_permissions_instructions: false,
        project_doc_max_bytes: 0,
        "skills.include_instructions": false,
      },
      reasoningEffort: "high",
    }),
    srcPath: getSrcPath(options.srcPath),
    styleguides: fileURLToPath(new URL("../.eloqnt", import.meta.url)),
  });
}

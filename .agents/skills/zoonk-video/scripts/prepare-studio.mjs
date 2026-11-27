import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const skill = path.dirname(import.meta.dirname);
export const repo = path.resolve(skill, "../../..");

/** The harness source and checkout dependencies shared by init and the regression check. */
export function prepareStudio(work, port) {
  mkdirSync(work, { recursive: true });
  for (const [from, to] of [
    ["engine", "engine"],
    ["scripts", "scripts"],
    ["realui", "realui"],
    ["example/zoonk-2", "films/zoonk-2"],
    ["example/launch", "films/launch"],
  ]) {
    cpSync(path.join(skill, from), path.join(work, to), { recursive: true, force: false });
  }
  writeFileSync(path.join(work, "studio.json"), `${JSON.stringify({ port, repo }, null, 2)}\n`);
  // The page's React, the AI SDK, Vite and Playwright come from the repo, so the harness renders with the
  // app's exact versions and Playwright finds the browsers the repo's tests installed. npm install drops
  // these links, so they're made after it.
  const player = path.join(repo, "packages/player/node_modules");
  /** pnpm puts a package's dependencies next to it, in the node_modules folder that holds it. */
  const besides = (dir) => {
    const parts = realpathSync(dir).split(path.sep);
    return parts.slice(0, parts.lastIndexOf("node_modules") + 1).join(path.sep);
  };
  const links = {
    ai: path.join(player, "ai"),
    react: path.join(player, "react"),
    "react-dom": path.join(player, "react-dom"),
    "next-intl": path.join(player, "next-intl"),
    "lucide-react": path.join(player, "lucide-react"),
    "@vitejs/plugin-react": path.join(player, "@vitejs/plugin-react"),
    "@tailwindcss/vite": path.join(player, "@tailwindcss/vite"),
    vite: path.join(besides(path.join(player, "@vitejs/plugin-react")), "vite"),
    "playwright-core": path.join(besides(path.join(player, "playwright")), "playwright-core"),
  };
  for (const [name, target] of Object.entries(links)) {
    const link = path.join(work, "node_modules", name);
    rmSync(link, { force: true, recursive: true });
    mkdirSync(path.dirname(link), { recursive: true });
    symlinkSync(realpathSync(target), link, "dir");
  }

  const modules = path.join(work, "node_modules");
  execFileSync("python3", [path.join(work, "realui/goals/buddy-gen.py")], { stdio: "inherit" });

  // The views type-check against the repo's own sources and React types, as the app does.
  const types = path.join(repo, "packages/ui/node_modules/@types");
  writeFileSync(
    path.join(work, "realui/tsconfig.json"),
    `${JSON.stringify(
      {
        extends: path.join(repo, "packages/tsconfig/base.json"),
        compilerOptions: {
          allowImportingTsExtensions: true,
          incremental: false,
          jsx: "react-jsx",
          paths: {
            "@repo/*": [`${repo}/*`],
            react: [path.join(types, "react")],
            "react/*": [path.join(types, "react/*")],
            "react-dom": [path.join(types, "react-dom")],
            "react-dom/*": [path.join(types, "react-dom/*")],
          },
          typeRoots: [types],
          types: ["node", "react"],
        },
        files: [
          path.join(repo, "packages/tsconfig/markdown.d.ts"),
          path.join(repo, "apps/main/src/i18n/po.d.ts"),
          path.join(modules, "vite/client.d.ts"),
        ],
        include: ["**/*.ts", "**/*.tsx", "../films/*/scenes.ts"],
      },
      null,
      2,
    )}\n`,
  );
}
